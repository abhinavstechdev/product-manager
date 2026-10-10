import crypto from "crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Helper to calculate exact sha256 digest of UTF-8 text
export function computeSha256(content: string): string {
  return `sha256:${crypto.createHash("sha256").update(content, "utf8").digest("hex")}`;
}

// 1. Skill: Inventory & Order Operations (Standard Operating Procedures)
const INVENTORY_OPS_SKILL_MD = `---
name: inventory-order-ops
description: Standard operating procedures for inventory allocation, manual order processing, packing slips, shipping dispatch, and customer returns in Apex Commerce.
---

# Apex Inventory & Order Operations SOP

## 1. Stock Allocation Principles
- Mathematical Rule: Available Stock = Physical Stock - Reserved Stock.
- When an order is placed in status NEW or CONFIRMED, stock is immediately RESERVED.
- When an order is dispatched (SHIPPED), physical stock is reduced and the reservation is released.
- Never sell below 0 available stock. If stock is insufficient, prompt the operator or decline reservation.

## 2. Order Lifecycle Progression
1. **NEW / CONFIRMED**: Order placed and inventory reserved. Awaiting warehouse pick.
2. **PROCESSING / PACKED**: Order picked and packed. Packing slip generated (customer payment methods omitted for privacy).
3. **SHIPPED**: Courier dispatched with AWB tracking ID. Physical stock reduced.
4. **DELIVERED**: Carrier confirms handover. (Delivered status does NOT auto-mark order as paid).
5. **CANCELLED / RETURNED**: Release reservations or quarantine returned stock for quality control.

## 3. High-Impact Safety Confirmations
High-impact operations require a human confirmation token via request_action_confirmation before execution:
- Deductive inventory adjustments (adjust_inventory with negative quantity)
- Order cancellations (cancel_order)
- Archive product (archive_product)

## 4. Multi-Tender Payment Processing
- Accepted payment methods: CASH, COD, UPI, BANK_TRANSFER.
- Orders support partial payment; remaining balance is calculated automatically.
`;

const ALLOCATION_RULES_REF_MD = `# Allocation & Ledger Movement Reference

## Transaction Types & Formulas
| Type | Physical Stock | Reserved Stock | Available Stock | Notes |
| :--- | :---: | :---: | :---: | :--- |
| OPENING_STOCK | +N | 0 | +N | Initial stock count |
| STOCK_RECEIVED | +N | 0 | +N | Supplier PO delivery |
| MANUAL_ADJUSTMENT | +/-N | 0 | +/-N | Physical audit correction |
| STOCK_RESERVED | 0 | +N | -N | Order creation |
| RESERVATION_RELEASED | 0 | -N | +N | Order cancelled |
| ORDER_DISPATCHED | -N | -N | 0 | Courier dispatch |
| RETURN_APPROVED_RESALE | +N | 0 | +N | QC passed return |
| DAMAGED_GOODS | 0 | 0 | 0 | Written off to quarantine |

## Quality Control Inspection for Returns
- When processing returns, inspect condition:
  - If condition is SELLABLE, call approve_return to automatically restock inventory.
  - If condition is DAMAGED, reject resale and record as DAMAGED_GOODS in quarantine.
`;

// Calculate digests
const INVENTORY_OPS_SKILL_DIGEST = computeSha256(INVENTORY_OPS_SKILL_MD);
const ALLOCATION_RULES_DIGEST = computeSha256(ALLOCATION_RULES_REF_MD);

export interface McpSkillResource {
  uri: string;
  digest: string;
  mimeType: string;
  text: string;
}

export interface McpSkillEntry {
  uri: string;
  frontmatter: {
    name: string;
    description: string;
    [key: string]: any;
  };
  resources: Array<{
    uri: string;
    digest: string;
  }>;
}

export const REGISTERED_SKILLS: Record<string, { entry: McpSkillEntry; fileMap: Record<string, McpSkillResource> }> = {
  "inventory-order-ops": {
    entry: {
      uri: "skill://apex-commerce/inventory-order-ops/SKILL.md",
      frontmatter: {
        name: "inventory-order-ops",
        description:
          "Standard operating procedures for inventory allocation, manual order processing, packing slips, shipping dispatch, and customer returns in Apex Commerce.",
      },
      resources: [
        {
          uri: "skill://apex-commerce/inventory-order-ops/SKILL.md",
          digest: INVENTORY_OPS_SKILL_DIGEST,
        },
        {
          uri: "skill://apex-commerce/inventory-order-ops/references/allocation-rules.md",
          digest: ALLOCATION_RULES_DIGEST,
        },
      ],
    },
    fileMap: {
      "skill://apex-commerce/inventory-order-ops/SKILL.md": {
        uri: "skill://apex-commerce/inventory-order-ops/SKILL.md",
        digest: INVENTORY_OPS_SKILL_DIGEST,
        mimeType: "text/markdown",
        text: INVENTORY_OPS_SKILL_MD,
      },
      "skill://apex-commerce/inventory-order-ops/references/allocation-rules.md": {
        uri: "skill://apex-commerce/inventory-order-ops/references/allocation-rules.md",
        digest: ALLOCATION_RULES_DIGEST,
        mimeType: "text/markdown",
        text: ALLOCATION_RULES_REF_MD,
      },
    },
  },
};

const SkillsListRequestSchema = z.object({
  method: z.literal("skills/list"),
  params: z
    .object({
      cursor: z.string().optional(),
    })
    .optional(),
});

const SkillsGetRequestSchema = z.object({
  method: z.literal("skills/get"),
  params: z.object({
    uri: z.string(),
  }),
});

/**
 * Register Skills Extension handlers and resources on the McpServer instance
 */
export function registerSkillsExtension(mcpServer: McpServer) {
  // 1. Register skill files as standard resources for resources/read
  for (const skillKey of Object.keys(REGISTERED_SKILLS)) {
    const skill = REGISTERED_SKILLS[skillKey];
    for (const [uri, resource] of Object.entries(skill.fileMap)) {
      mcpServer.resource(
        `skill-${skillKey}-${uri.split("/").pop()}`,
        uri,
        {
          mimeType: resource.mimeType,
          description: `Skill resource for ${skillKey}: ${uri}`,
        },
        async () => ({
          contents: [
            {
              uri: resource.uri,
              mimeType: resource.mimeType,
              text: resource.text,
            },
          ],
        })
      );
    }
  }

  // 2. Register skills/list request handler (SEP-2640)
  mcpServer.server.setRequestHandler(SkillsListRequestSchema, async () => {
    const skillsList = Object.values(REGISTERED_SKILLS).map((s) => s.entry);
    return {
      skills: skillsList,
      nextCursor: undefined,
    } as any;
  });

  // 3. Register skills/get request handler (SEP-2640)
  mcpServer.server.setRequestHandler(SkillsGetRequestSchema, async (request) => {
    const requestedUri = request.params.uri;
    for (const s of Object.values(REGISTERED_SKILLS)) {
      if (s.entry.uri === requestedUri) {
        return {
          skill: s.entry,
        } as any;
      }
    }
    throw new Error(`Skill not found for URI: ${requestedUri}`);
  });
}
