import { NextRequest, NextResponse } from "next/server";

import { hasCapability } from "@/lib/platform/client-access";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";
import {
  boundedIds,
  labelItemFromRows,
  templateFromRow,
  templateToRow,
  type LabelStudioIdentityRow,
  type LabelStudioInventoryRow,
  type LabelStudioPriceReviewRow,
  type LabelStudioTemplateRow,
} from "@/lib/label-studio/persistence";
import { createDefaultLabelTemplate, validateLabelTemplate, type LabelTemplate } from "@/lib/label-studio/label-templates";
import { labelBody, labelFailure } from '@/lib/label-studio/server';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await requireLabelStudio("label.view");
  if (!context.ok) return context.response;

  const workspaceId = context.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Choose an active workspace before using Label Studio." }, { status: 400 });

  const origin = request.nextUrl.origin;
  const selectedIds = boundedIds(request.nextUrl.searchParams.get("ids"));
  const source = request.nextUrl.searchParams.get("source") ?? "operations";
  const mode = request.nextUrl.searchParams.get("mode") ?? "label-studio";

  const [templatesResult, inventoryResult, reviewsResult] = await Promise.all([
    context.supabase
      .from("label_templates")
      .select("id,workspace_id,name,category,width,height,unit,orientation,qr_enabled,barcode_enabled,logo_enabled,price_field,pricing_rule,template_data")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    inventoryQuery(context.supabase, workspaceId, selectedIds, context.user!.id),
    context.supabase
      .from("inventory_price_reviews")
      .select("id,workspace_id,inventory_identity_id,inventory_item_id,current_asking_price,proposed_asking_price,market_price,variance_percent,status")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (templatesResult.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  if (inventoryResult.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  if (reviewsResult.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });

  const inventoryRows = (inventoryResult.data ?? []) as LabelStudioInventoryRow[];
  const itemIds = inventoryRows.map((item) => item.id);
  const identityResult = itemIds.length
    ? await context.supabase
      .from("inventory_label_identities")
      .select("id,workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token,barcode_value,status,public_enabled,revoked_at")
      .eq("workspace_id", workspaceId)
      .eq("inventory_user_id", context.user!.id)
      .is("inventory_position_id", null)
      .in("inventory_item_id", itemIds)
      .eq("status", "active")
      .is("revoked_at", null)
    : { data: [], error: null };
  if (identityResult.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });

  const identities = new Map(
    ((identityResult.data ?? []) as LabelStudioIdentityRow[]).map((identity) => [identity.inventory_item_id, identity]),
  );
  const templates = ((templatesResult.data ?? []) as LabelStudioTemplateRow[]).map(templateFromRow);
  const items = inventoryRows.map((item) => labelItemFromRows(item, identities.get(item.id) ?? null, origin));

  return NextResponse.json({
    workspaceId,
    source,
    mode,
    contextSelection: selectedIds,
    templates: templates.length ? templates : [createDefaultLabelTemplate({
      id: "local-default-single",
      workspaceId,
      name: "Singles 2 x 1",
      category: source === "sealed-inventory" ? "sealed" : "single",
      sizePresetId: source === "sealed-inventory" ? "4x2" : "2x1",
    })],
    items,
    priceReviews: reviewsResult.data as LabelStudioPriceReviewRow[],
    capabilities: {
      canManageTemplates: hasCapability(context.access, "label.manage_templates"),
      canPrint: hasCapability(context.access, "label.print"),
      canReprice: hasCapability(context.access, "inventory.reprice"),
    },
    environment: {
      supabaseHost: safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL),
      stagingUnverified: true,
    },
  });
}

export async function POST(request: NextRequest) {
  let body: { action?: string; [key: string]: unknown };
  try { body = await labelBody(request) as typeof body; } catch (error) { return labelFailure(error); }
  if (!body?.action) return NextResponse.json({ error: "Choose a Label Studio action." }, { status: 400 });

  if (body.action === "save-template") return saveTemplate(body);
  if (body.action === "archive-template") return archiveTemplate(body);
  if (body.action === "default-template") {
    const context = await requireLabelStudio('label.manage_templates');
    if (!context.ok) return context.response;
    const { error } = await context.supabase.rpc('set_default_label_template', { p_workspace_id: context.access.workspaceId, p_template_id: body.templateId });
    return error ? labelFailure(new Error('Default template could not be updated.')) : NextResponse.json({ ok: true });
  }
  if (body.action === "resolve-identities") return resolveIdentities(request, body);
  if (body.action === "record-print-job") return recordPrintJob(body);
  if (body.action === "review-price") return reviewPrice(body);

  return NextResponse.json({ error: "Unsupported Label Studio action." }, { status: 400 });
}

async function saveTemplate(body: Record<string, unknown>) {
  const context = await requireLabelStudio("label.manage_templates");
  if (!context.ok) return context.response;
  const workspaceId = context.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Choose an active workspace before saving templates." }, { status: 400 });

  const template = body.template as LabelTemplate | undefined;
  if (typeof template?.id === 'string' && template.id.startsWith("system-")) return NextResponse.json({ error: "Duplicate a system preset before saving it." }, { status: 400 });
  if (!template) return NextResponse.json({ error: "Template payload is required." }, { status: 400 });
  const validation = validateLabelTemplate({ ...template, workspaceId });
  if (typeof template.id !== 'string') return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  if (!validation.ok) return NextResponse.json({ error: "Fix template fields before saving.", details: validation.errors }, { status: 400 });

  const row = templateToRow({ ...template, workspaceId }, workspaceId);
  const query = template.id && !template.id.startsWith("local-")
    ? context.supabase.from("label_templates").update(row).eq("workspace_id", workspaceId).eq("id", template.id).select("id,workspace_id,name,category,width,height,unit,orientation,qr_enabled,barcode_enabled,logo_enabled,price_field,pricing_rule,template_data").single()
    : context.supabase.from("label_templates").insert(row).select("id,workspace_id,name,category,width,height,unit,orientation,qr_enabled,barcode_enabled,logo_enabled,price_field,pricing_rule,template_data").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  return NextResponse.json({ template: templateFromRow(data as LabelStudioTemplateRow) });
}

async function archiveTemplate(body: Record<string, unknown>) {
  const context = await requireLabelStudio("label.manage_templates");
  if (!context.ok) return context.response;
  const workspaceId = context.access.workspaceId;
  const id = typeof body.templateId === "string" ? body.templateId : "";
  if (!workspaceId || !id) return NextResponse.json({ error: "Template id is required." }, { status: 400 });
  const { error } = await context.supabase
    .from("label_templates")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function resolveIdentities(request: NextRequest, body: Record<string, unknown>) {
  const context = await requireLabelStudio("label.print");
  if (!context.ok) return context.response;
  const workspaceId = context.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Choose an active workspace before resolving labels." }, { status: 400 });
  const ids = Array.isArray(body.inventoryItemIds)
    ? body.inventoryItemIds.filter((id): id is string => typeof id === "string").slice(0, 100)
    : [];
  if (!ids.length) return NextResponse.json({ identities: [] });

  const inventory = await inventoryQuery(context.supabase, workspaceId, ids, context.user!.id);
  if (inventory.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  const rows = (inventory.data ?? []) as LabelStudioInventoryRow[];
  if (rows.length !== ids.length) return NextResponse.json({ error: "Some selected inventory is unavailable in this workspace." }, { status: 403 });

  const existingResult = await context.supabase
    .from("inventory_label_identities")
    .select("id,workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token,barcode_value,status,public_enabled,revoked_at")
    .eq("workspace_id", workspaceId)
    .eq("inventory_user_id", context.user!.id)
    .is("inventory_position_id", null)
    .in("inventory_item_id", ids)
    .eq("status", "active")
    .is("revoked_at", null);
  if (existingResult.error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });

  const existing = new Map(((existingResult.data ?? []) as LabelStudioIdentityRow[]).map((identity) => [identity.inventory_item_id, identity]));
  const missing = rows.filter((row) => !existing.has(row.id));
  if (missing.length) {
    const { data, error } = await context.supabase
      .from("inventory_label_identities")
      .insert(missing.map((row) => ({
        workspace_id: workspaceId,
        inventory_user_id: row.user_id,
        inventory_item_id: row.id,
        target_type: row.item_kind ?? "single",
        sku: "",
        qr_token: "",
        barcode_value: row.barcode_value ?? row.upc ?? null,
        public_enabled: false,
      })))
      .select("id,workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token,barcode_value,status,public_enabled,revoked_at");
    if (error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
    for (const identity of (data ?? []) as LabelStudioIdentityRow[]) existing.set(identity.inventory_item_id, identity);
  }

  const origin = request.nextUrl.origin;
  return NextResponse.json({
    items: rows.map((row) => labelItemFromRows(row, existing.get(row.id) ?? null, origin)),
  });
}

async function recordPrintJob(body: Record<string, unknown>) {
  const context = await requireLabelStudio("label.print");
  if (!context.ok) return context.response;
  const workspaceId = context.access.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Choose an active workspace before printing labels." }, { status: 400 });
  const labelCount = Math.max(0, Math.min(10000, Number(body.labelCount) || 0));
  const pageCount = Math.max(0, Math.min(1000, Number(body.pageCount) || 0));
  const { data, error } = await context.supabase
    .from("label_print_jobs")
    .insert({
      workspace_id: workspaceId,
      template_id: typeof body.templateId === "string" && !body.templateId.startsWith("local-") ? body.templateId : null,
      status: "printed",
      label_count: labelCount,
      page_count: pageCount,
      printer_target: "browser",
      selection_data: { source: body.source, mode: body.mode, selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds.slice(0, 100) : [] },
      render_summary: { templateName: body.templateName, generatedAt: new Date().toISOString() },
      printed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  return NextResponse.json({ printJobId: data.id });
}

async function reviewPrice(body: Record<string, unknown>) {
  const context = await requireLabelStudio("inventory.reprice");
  if (!context.ok) return context.response;
  const workspaceId = context.access.workspaceId;
  const reviewId = typeof body.reviewId === "string" ? body.reviewId : "";
  const decision = body.decision === "approve" ? "approve" : body.decision === "dismiss" ? "dismiss" : null;
  if (!workspaceId || !reviewId || !decision) return NextResponse.json({ error: "Choose a repricing action." }, { status: 400 });

  const { data: review, error: reviewError } = await context.supabase
    .from("inventory_price_reviews")
    .select("id,inventory_item_id,proposed_asking_price")
    .eq("workspace_id", workspaceId)
    .eq("id", reviewId)
    .eq("status", "pending")
    .single();
  if (reviewError) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });

  if (decision === "approve") {
    const { error: itemError } = await context.supabase
      .from("inventory_items")
      .update({ asking_price: review.proposed_asking_price })
      .eq("workspace_id", workspaceId)
      .eq("id", review.inventory_item_id);
    if (itemError) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  }

  const { error } = await context.supabase
    .from("inventory_price_reviews")
    .update({
      status: decision === "approve" ? "applied" : "dismissed",
      reviewed_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", reviewId);
  if (error) return NextResponse.json({ error: "Label Studio could not complete this operation. Check workspace access, inventory selection, or the template name." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function inventoryQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  ids: string[],
  ownerId: string,
) {
  let query = supabase
    .from("inventory_items")
    .select("id,user_id,workspace_id,item_kind,card_name,product_name,set_code,collector_number,sku,barcode_value,upc,asking_price,market_price,data")
    .eq("workspace_id", workspaceId).eq("user_id", ownerId);
  if (ids.length) query = query.in("id", ids);
  return query.order("updated_at", { ascending: false }).limit(ids.length || 24);
}

async function requireLabelStudio(capability: "label.view" | "label.manage_templates" | "label.print" | "inventory.reprice") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const access = await resolvePlatformAccessForUser(supabase, user);
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasCapability(access, capability)) {
    return { ok: false as const, response: NextResponse.json({ error: "Label Studio access is not available for this workspace." }, { status: 403 }) };
  }
  return { ok: true as const, supabase, user, access };
}

function safeHost(value: string | undefined) {
  try {
    return value ? new URL(value).host : null;
  } catch {
    return null;
  }
}
