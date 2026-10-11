import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession, getOptionalSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getOptionalSession();
    const workspaceId = session?.workspaceId || "ws_apex_main";
    const db = await getDb();

    const [ws] = await (db as any)
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        companyName: ws.companyName || ws.name || "Apex Logistics",
        companyAddress: ws.companyAddress || "Plot 42, Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka - 560100, India",
        companyPhone: ws.companyPhone || "+91 98765 43210",
        companyEmail: ws.companyEmail || "billing@apexlogistics.in",
        companyTaxId: ws.companyTaxId || "GSTIN: 29ABCDE1234F1Z5",
        companyLogoUrl: ws.companyLogoUrl || "",
        companyWebsite: ws.companyWebsite || "https://product-manager-kappa-two.vercel.app",
        invoicePrefix: ws.invoicePrefix || "INV",
        invoiceFooterNotes:
          ws.invoiceFooterNotes ||
          "1. This is a computer-generated tax invoice and requires no physical signature.\n2. Goods once sold can be returned within 7 days in original condition with QC verification.\n3. All disputes subject to local jurisdiction.",
        timezone: ws.timezone || "Asia/Kolkata",
        currency: ws.currency || "INR",
        name: ws.name,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOptionalSession();
    const workspaceId = session?.workspaceId || "ws_apex_main";
    const body = await request.json();
    const db = await getDb();

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.companyName !== undefined) {
      updatePayload.companyName = body.companyName;
      updatePayload.name = body.companyName;
    } else if (body.name !== undefined) {
      updatePayload.name = body.name;
    }
    if (body.companyAddress !== undefined) updatePayload.companyAddress = body.companyAddress;
    if (body.companyPhone !== undefined) updatePayload.companyPhone = body.companyPhone;
    if (body.companyEmail !== undefined) updatePayload.companyEmail = body.companyEmail;
    if (body.companyTaxId !== undefined) updatePayload.companyTaxId = body.companyTaxId;
    if (body.companyLogoUrl !== undefined) updatePayload.companyLogoUrl = body.companyLogoUrl;
    if (body.companyWebsite !== undefined) updatePayload.companyWebsite = body.companyWebsite;
    if (body.invoicePrefix !== undefined) updatePayload.invoicePrefix = body.invoicePrefix;
    if (body.invoiceFooterNotes !== undefined) updatePayload.invoiceFooterNotes = body.invoiceFooterNotes;
    if (body.timezone !== undefined) updatePayload.timezone = body.timezone || "Asia/Kolkata";
    if (body.currency !== undefined) updatePayload.currency = body.currency || "INR";

    await (db as any)
      .update(workspaces)
      .set(updatePayload)
      .where(eq(workspaces.id, workspaceId));

    return NextResponse.json({
      success: true,
      message: "Company and billing settings updated successfully!",
      settings: {
        companyName: updatePayload.companyName,
        companyLogoUrl: updatePayload.companyLogoUrl,
        currency: updatePayload.currency,
        timezone: updatePayload.timezone,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
