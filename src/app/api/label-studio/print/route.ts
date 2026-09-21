import {
  labelBody,
  labelContext,
  labelFailure,
  issueLabelTargets,
} from "@/lib/label-studio/server";
import { buildLabelDocument } from "@/lib/label-studio/print-document";
import {
  validateLabelTemplate,
  type LabelTemplate,
} from "@/lib/label-studio/label-templates";
import {
  DEFAULT_PRINT_SETTINGS,
  type LabelTarget,
} from "@/lib/label-studio/print-settings";
export async function POST(request: Request) {
  try {
    const body = await labelBody(request);
    const c = await labelContext("label.print");
    if (!c.ok) return c.response;
    const template = {
      ...(body.template as LabelTemplate),
      workspaceId: c.workspaceId,
    };
    if (!validateLabelTemplate(template).ok)
      throw new Error("Invalid template settings.");
    if (!Array.isArray(body.queue) || body.queue.length > 500)
      throw new Error("Invalid print queue.");
    const queue = body.queue as { key: string; copies: number }[];
    if (
      queue.some(
        (row) =>
          !row ||
          typeof row.key !== "string" ||
          !Number.isInteger(row.copies) ||
          row.copies < 1 ||
          row.copies > 1000,
      )
    )
      throw new Error("Invalid print quantities.");
    let targets: LabelTarget[] = [];
    if (body.test === true) {
      template.barcodeEnabled = true;
      template.qrEnabled = false;
      template.print = {
        ...(template.print ?? DEFAULT_PRINT_SETTINGS),
        fields: ["name", "printing", "details", "store"],
        fontPt: 6.5,
        priceEmphasis: false,
        humanReadable: true,
        storeName: "Trading Docks",
      };
      const timestamp = new Date().toISOString();
      targets = [
        {
          key: "test",
          itemId: "test",
          positionId: null,
          name: "TEST LABEL",
          set: `${template.width} × ${template.height} ${template.unit}`,
          number: null,
          condition: timestamp.slice(0, 10),
          finish: `${timestamp.slice(11, 19)} UTC`,
          language: null,
          location: "Trading Docks",
          batch: null,
          quantity: 1,
          price: null,
          sku: "TD-TEST-0001",
          identityId: null,
          qrToken: null,
        },
      ];
    } else {
      if (!queue.length) throw new Error("Add inventory to the print queue.");
      targets = await issueLabelTargets(
        c,
        queue.map((row) => row.key),
      );
    }
    const resolved =
      body.test === true
        ? [{ target: targets[0], copies: 1 }]
        : queue.map((row) => {
            const target = targets.find((t) => t.key === row.key);
            if (!target)
              throw new Error(
                "Selected inventory is no longer available. Refresh the queue.",
              );
            return { target, copies: row.copies };
          });
    const html = await buildLabelDocument(
      template,
      resolved,
      body.preview === true,
    );
    if (body.preview !== true && body.test !== true) {
      const count = resolved.reduce((n, row) => n + row.copies, 0);
      const { error } = await c.supabase.from("label_print_jobs").insert({
        workspace_id: c.workspaceId,
        status: "preview",
        label_count: count,
        page_count:
          template.print?.mode === "sheet"
            ? Math.ceil(
                count /
                  (template.print.sheet.rows * template.print.sheet.columns),
              )
            : count,
        printer_target: "browser",
        selection_data: {
          source: [
            "inventory",
            "batch",
            "chaos_sort",
            "pos",
            "manual",
            "reprint",
          ].includes(String(body.source))
            ? body.source
            : "manual",
          ids: queue.map((row) => row.key),
        },
        render_summary: { templateName: template.name, dialogPrepared: true },
      });
      if (error) throw new Error("Could not record the prepared print job.");
    }
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return labelFailure(error);
  }
}
