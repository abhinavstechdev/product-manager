// MCP Events Extension Implementation
// Compliant with MCP 2.0 (protocol version 2026-07-28), ChatGPT MCP Events Specification,
// Standard Webhooks (RFC-compliant HMAC signing), and Callback Verification Challenges.

import crypto from "crypto";
import { Webhook } from "standardwebhooks";
import { getDb } from "../db/client";
import { eventSubscriptions } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const MCP_EVENTS_PROTOCOL_VERSION = "2026-07-28";

// 1. Available Event Definitions for Apex Commerce Platform
export const AVAILABLE_EVENTS = [
  {
    name: "order.created",
    description: "A new customer order was placed and inventory was reserved in Apex Commerce.",
    delivery: ["webhook"],
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional order status filter (e.g. CONFIRMED, NEW)",
        },
        customer_id: {
          type: "string",
          description: "Optional customer ID to monitor orders for a specific customer",
        },
        min_total: {
          type: "number",
          description: "Optional minimum order total filter in store currency",
        },
      },
      additionalProperties: false,
    },
    payloadSchema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        order_number: { type: "string" },
        customer_name: { type: "string" },
        total_amount: { type: "number" },
        status: { type: "string" },
        payment_status: { type: "string" },
        items_count: { type: "number" },
        url: { type: "string" },
      },
      required: ["order_id", "order_number", "total_amount", "status", "payment_status", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "order.status_changed",
    description: "An order transitioned between status stages (e.g. PACKED, SHIPPED, DELIVERED, CANCELLED).",
    delivery: ["webhook"],
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Optional specific order ID to monitor",
        },
        status: {
          type: "string",
          description: "Optional target status to monitor (e.g. PACKED, SHIPPED, DELIVERED, CANCELLED)",
        },
      },
      additionalProperties: false,
    },
    payloadSchema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        order_number: { type: "string" },
        previous_status: { type: "string" },
        current_status: { type: "string" },
        tracking_number: { type: "string" },
        courier: { type: "string" },
        url: { type: "string" },
      },
      required: ["order_id", "order_number", "previous_status", "current_status", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "inventory.low_stock",
    description: "Product available inventory dropped below reorder safety threshold.",
    delivery: ["webhook"],
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Optional SKU code to monitor",
        },
        category_id: {
          type: "string",
          description: "Optional category ID filter",
        },
      },
      additionalProperties: false,
    },
    payloadSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        sku: { type: "string" },
        name: { type: "string" },
        physical_stock: { type: "number" },
        reserved_stock: { type: "number" },
        available_stock: { type: "number" },
        threshold: { type: "number" },
        url: { type: "string" },
      },
      required: ["product_id", "sku", "name", "physical_stock", "available_stock", "threshold", "url"],
      additionalProperties: false,
    },
  },
  {
    name: "inventory.adjusted",
    description: "A physical stock movement, supplier receipt, or manual audit adjustment occurred.",
    delivery: ["webhook"],
    inputSchema: {
      type: "object",
      properties: {
        sku: {
          type: "string",
          description: "Optional SKU filter",
        },
        type: {
          type: "string",
          description: "Optional transaction type (e.g. STOCK_RECEIVED, MANUAL_ADJUSTMENT)",
        },
      },
      additionalProperties: false,
    },
    payloadSchema: {
      type: "object",
      properties: {
        transaction_id: { type: "string" },
        sku: { type: "string" },
        product_name: { type: "string" },
        type: { type: "string" },
        quantity_change: { type: "number" },
        new_physical_stock: { type: "number" },
        notes: { type: "string" },
      },
      required: ["transaction_id", "sku", "type", "quantity_change", "new_physical_stock"],
      additionalProperties: false,
    },
  },
  {
    name: "return.requested",
    description: "A customer return was initiated and requires inspection or RMA approval.",
    delivery: ["webhook"],
    inputSchema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Optional order ID filter",
        },
      },
      additionalProperties: false,
    },
    payloadSchema: {
      type: "object",
      properties: {
        return_id: { type: "string" },
        order_id: { type: "string" },
        reason: { type: "string" },
        condition: { type: "string" },
        items_count: { type: "number" },
        url: { type: "string" },
      },
      required: ["return_id", "order_id", "reason", "condition", "url"],
      additionalProperties: false,
    },
  },
];

// In-memory cache for verified callback endpoints (10 min TTL)
const verifiedCallbacksCache = new Map<string, number>();

/**
 * Produce canonical JSON string with sorted object keys to ensure idempotent hashing
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalizeJson(obj[k]));
  return "{" + pairs.join(",") + "}";
}

/**
 * Derive deterministic subscription ID
 */
export function computeSubscriptionId(
  workspaceId: string,
  clientId: string,
  eventName: string,
  callbackUrl: string,
  canonicalArgs: string
): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${workspaceId}:${clientId}:${eventName}:${callbackUrl}:${canonicalArgs}`)
    .digest("hex")
    .slice(0, 16);
  return `sub_${hash}`;
}

/**
 * Validate whsec_ signing secret (must decode to 24-64 bytes)
 */
export function validateSigningSecret(secret: string): void {
  if (!secret || typeof secret !== "string" || !secret.startsWith("whsec_")) {
    throw new Error("Invalid signing secret: Must begin with 'whsec_'");
  }
  const b64 = secret.slice("whsec_".length);
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 24 || buf.length > 64) {
    throw new Error(`Invalid signing secret: Decoded base64 must be 24-64 bytes (received ${buf.length} bytes)`);
  }
}

/**
 * Callback URL validation and SSRF protection
 */
export function validateCallbackUrl(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error(`Invalid callback URL format: ${urlStr}`);
  }

  const isLocalDev =
    process.env.NODE_ENV !== "production" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname.endsWith(".local");

  if (!isLocalDev && url.protocol !== "https:") {
    throw new Error("Callback URL must use HTTPS in production");
  }

  // SSRF block for dangerous / internal metadata endpoints in production
  if (!isLocalDev) {
    const host = url.hostname.toLowerCase();
    if (
      host === "169.254.169.254" || // AWS metadata
      host === "metadata.google.internal" || // GCP metadata
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.16.")
    ) {
      throw new Error("Non-public / local network addresses are blocked for callback endpoints");
    }
  }

  return url;
}

export class CallbackEndpointError extends Error {
  code = -32015;
  reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "CallbackEndpointError";
    this.reason = reason;
  }
}

/**
 * Verify callback URL with a signed random challenge
 */
export async function verifyCallbackEndpoint(
  workspaceId: string,
  callbackUrl: string,
  secret: string,
  subscriptionId: string,
  customFetch: typeof fetch = fetch
): Promise<void> {
  const cacheKey = `${workspaceId}:${callbackUrl}`;
  const cachedAt = verifiedCallbacksCache.get(cacheKey);
  const now = Date.now();

  // If verified within the last 10 minutes, skip re-verification challenge
  if (cachedAt && now - cachedAt < 10 * 60 * 1000) {
    return;
  }

  const challenge = crypto.randomBytes(16).toString("hex");
  const verificationPayload = {
    type: "verification",
    challenge,
  };
  const body = JSON.stringify(verificationPayload);
  const signedAt = new Date();
  const signer = new Webhook(secret);
  const webhookId = `msg_verification_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const timestampStr = String(Math.floor(signedAt.getTime() / 1000));
  const signature = signer.sign(webhookId, signedAt, body);

  let response: Response;
  try {
    response = await customFetch(callbackUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": timestampStr,
        "webhook-signature": signature,
        "X-MCP-Subscription-Id": subscriptionId,
      },
      body,
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.message?.includes("timeout")) {
      throw new CallbackEndpointError("timeout", `Callback verification timed out for ${callbackUrl}`);
    }
    throw new CallbackEndpointError("connection_failed", `Callback verification request failed: ${err.message}`);
  }

  if (!response.ok) {
    throw new CallbackEndpointError(
      "challenge_failed",
      `Callback endpoint returned HTTP ${response.status} during verification challenge`
    );
  }

  let resJson: any;
  try {
    resJson = await response.json();
  } catch {
    throw new CallbackEndpointError("challenge_failed", "Callback endpoint did not return valid JSON challenge response");
  }

  const returnedChallenge = String(resJson?.challenge || "");
  const challengeBuf = Buffer.from(challenge);
  const returnedBuf = Buffer.from(returnedChallenge);

  if (challengeBuf.length !== returnedBuf.length || !crypto.timingSafeEqual(challengeBuf, returnedBuf)) {
    throw new CallbackEndpointError("challenge_failed", "Callback endpoint returned invalid challenge response");
  }

  // Cache successful verification
  verifiedCallbacksCache.set(cacheKey, now);
}

/**
 * Send signed event to a subscription endpoint
 */
export async function sendEvent(
  subscription: { id: string; url: string; secret: string },
  event: {
    eventId: string;
    name: string;
    timestamp: string;
    data: any;
    cursor: string | null;
  },
  webhookFetch: typeof fetch = fetch
) {
  const body = JSON.stringify(event);
  if (Buffer.byteLength(body, "utf8") > 256 * 1024) {
    throw new Error("Event payload exceeds 256 KiB");
  }

  const signedAt = new Date();
  const signer = new Webhook(subscription.secret);
  const response = await webhookFetch(subscription.url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      "webhook-id": event.eventId,
      "webhook-timestamp": String(Math.floor(signedAt.getTime() / 1000)),
      "webhook-signature": signer.sign(event.eventId, signedAt, body),
      "X-MCP-Subscription-Id": subscription.id,
    },
    body,
  });

  return { accepted: response.ok, status: response.status };
}

/**
 * Handle events/subscribe request
 */
export async function handleSubscribe(
  workspaceId: string,
  clientId: string,
  params: {
    name: string;
    arguments?: Record<string, any>;
    delivery: {
      mode: string;
      url: string;
      secret: string;
    };
    cursor?: string | null;
    ttlMs?: number | null;
  },
  customFetch: typeof fetch = fetch
) {
  const eventDef = AVAILABLE_EVENTS.find((e) => e.name === params.name);
  if (!eventDef) {
    throw new Error(`Unsupported event: ${params.name}`);
  }

  if (params.delivery.mode !== "webhook") {
    throw new Error(`Unsupported delivery mode: ${params.delivery.mode}. Only 'webhook' is supported.`);
  }

  validateSigningSecret(params.delivery.secret);
  validateCallbackUrl(params.delivery.url);

  const rawArgs = params.arguments || {};
  const canonicalArgs = canonicalizeJson(rawArgs);
  const subId = computeSubscriptionId(
    workspaceId,
    clientId,
    params.name,
    params.delivery.url,
    canonicalArgs
  );

  // Perform challenge verification
  await verifyCallbackEndpoint(
    workspaceId,
    params.delivery.url,
    params.delivery.secret,
    subId,
    customFetch
  );

  // Determine expiration TTL
  let ttlMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
  if (params.ttlMs !== undefined && params.ttlMs !== null) {
    // Clamp between 1 hour and 30 days
    ttlMs = Math.max(3600_000, Math.min(params.ttlMs, 30 * 24 * 60 * 60 * 1000));
  }
  const refreshBefore = new Date(Date.now() + ttlMs);

  // Store in database idempotently
  const db = await getDb();
  const now = new Date();

  await (db as any)
    .insert(eventSubscriptions)
    .values({
      id: subId,
      workspaceId,
      clientId,
      eventName: params.name,
      arguments: canonicalArgs,
      callbackUrl: params.delivery.url,
      secret: params.delivery.secret,
      active: true,
      refreshBefore,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: eventSubscriptions.id,
      set: {
        secret: params.delivery.secret,
        active: true,
        refreshBefore,
        updatedAt: now,
      },
    });

  return {
    id: subId,
    refreshBefore: refreshBefore.toISOString(),
    cursor: null,
    truncated: false,
  };
}

/**
 * Handle events/unsubscribe request
 */
export async function handleUnsubscribe(
  workspaceId: string,
  clientId: string,
  params: {
    name: string;
    arguments?: Record<string, any>;
    delivery: {
      mode: string;
      url: string;
    };
  }
) {
  const rawArgs = params.arguments || {};
  const canonicalArgs = canonicalizeJson(rawArgs);
  const subId = computeSubscriptionId(
    workspaceId,
    clientId,
    params.name,
    params.delivery.url,
    canonicalArgs
  );

  const db = await getDb();
  await (db as any)
    .update(eventSubscriptions)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(eventSubscriptions.id, subId),
        eq(eventSubscriptions.workspaceId, workspaceId)
      )
    );

  return {};
}

/**
 * Dispatch an application event to all active matching subscriptions
 */
export async function dispatchMcpEvent(
  workspaceId: string,
  eventName: string,
  eventData: Record<string, any>,
  customFetch: typeof fetch = fetch
) {
  try {
    const db = await getDb();
    const now = new Date();

    const activeSubs = await (db as any)
      .select()
      .from(eventSubscriptions)
      .where(
        and(
          eq(eventSubscriptions.workspaceId, workspaceId),
          eq(eventSubscriptions.eventName, eventName),
          eq(eventSubscriptions.active, true),
          gt(eventSubscriptions.refreshBefore, now)
        )
      );

    if (!activeSubs || activeSubs.length === 0) {
      return;
    }

    for (const sub of activeSubs) {
      // Evaluate filters in arguments
      let matches = true;
      try {
        const filterArgs = JSON.parse(sub.arguments || "{}");
        for (const [key, val] of Object.entries(filterArgs)) {
          if (val !== undefined && val !== null) {
            if (key === "min_total" && typeof val === "number") {
              if (Number(eventData.total_amount || 0) < val) {
                matches = false;
                break;
              }
            } else if (eventData[key] !== undefined && String(eventData[key]) !== String(val)) {
              matches = false;
              break;
            }
          }
        }
      } catch {
        matches = true;
      }

      if (!matches) continue;

      const eventPayload = {
        eventId: `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
        name: eventName,
        timestamp: new Date().toISOString(),
        data: eventData,
        cursor: null,
      };

      sendEvent(
        { id: sub.id, url: sub.callbackUrl, secret: sub.secret },
        eventPayload,
        customFetch
      ).catch(async (err: any) => {
        console.warn(`[MCP Events] Failed to deliver event to ${sub.callbackUrl}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error("[MCP Events] Error in dispatchMcpEvent:", err);
  }
}

// Zod Schemas for JSON-RPC Methods
const ServerDiscoverRequestSchema = z.object({
  method: z.literal("server/discover"),
  params: z.record(z.string(), z.any()).optional(),
});

const EventsListRequestSchema = z.object({
  method: z.literal("events/list"),
  params: z
    .object({
      cursor: z.string().nullable().optional(),
    })
    .optional(),
});

const EventsSubscribeRequestSchema = z.object({
  method: z.literal("events/subscribe"),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.any()).optional(),
    delivery: z.object({
      mode: z.string(),
      url: z.string(),
      secret: z.string(),
    }),
    cursor: z.string().nullable().optional(),
    ttlMs: z.number().nullable().optional(),
  }),
});

const EventsUnsubscribeRequestSchema = z.object({
  method: z.literal("events/unsubscribe"),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.any()).optional(),
    delivery: z.object({
      mode: z.string(),
      url: z.string(),
    }),
  }),
});

/**
 * Register MCP Events extension methods on the McpServer instance
 */
export function registerEventsExtension(
  mcpServer: McpServer,
  principal: { workspaceId: string; clientId: string; scopes: string[] }
) {
  // 1. server/discover (Capabilities & Version Negotiation)
  mcpServer.server.setRequestHandler(ServerDiscoverRequestSchema, async () => {
    return {
      resultType: "complete",
      supportedVersions: [MCP_EVENTS_PROTOCOL_VERSION],
      capabilities: {
        tools: {},
        events: {},
      },
    } as any;
  });

  // 2. events/list (Event Catalog Discovery)
  mcpServer.server.setRequestHandler(EventsListRequestSchema, async () => {
    return {
      events: AVAILABLE_EVENTS,
      nextCursor: null,
    } as any;
  });

  // 3. events/subscribe (Webhook Registration & Challenge Verification)
  mcpServer.server.setRequestHandler(EventsSubscribeRequestSchema, async (request) => {
    try {
      const result = await handleSubscribe(
        principal.workspaceId,
        principal.clientId,
        request.params
      );
      return result as any;
    } catch (err: any) {
      if (err instanceof CallbackEndpointError) {
        // Return standard MCP JSON-RPC CallbackEndpointError (-32015)
        const jsonRpcError: any = new Error(err.message);
        jsonRpcError.code = -32015;
        jsonRpcError.data = { reason: err.reason };
        throw jsonRpcError;
      }
      throw err;
    }
  });

  // 4. events/unsubscribe (Stop Subscription)
  mcpServer.server.setRequestHandler(EventsUnsubscribeRequestSchema, async (request) => {
    const result = await handleUnsubscribe(
      principal.workspaceId,
      principal.clientId,
      request.params
    );
    return result as any;
  });
}
