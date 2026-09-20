import { PaymentHistory } from "@/components/pos/PaymentHistory";
import Link from "next/link";
import { notFound } from "next/navigation";
import { posCommand, posContext } from "@/lib/pos/server";
import { money, type Bootstrap, type Receipt } from "@/lib/pos/domain";
import { RefundPanel, type RefundableItem } from "@/components/pos/RefundPanel";
export default async function Transaction({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const result = await posCommand("receipt", { saleId });
  if (result.response)
    return <p role="alert">This transaction is unavailable.</p>;
  const receipt = result.data?.receipt as Receipt | undefined;
  if (!receipt) notFound();
  const context = await posContext();
  const bootstrap = await posCommand("bootstrap", {});
  const refunds = (result.data.refunds ?? []) as {
    id: string;
    created_at: string;
    total_minor: number;
    reason: string;
  }[];
  const approval = result.data.approval as {
    name: string;
    at: string;
    reason: string;
  } | null;
  const movements = (result.data.inventoryEvents ?? []) as {
    at: string;
    kind: string;
    quantity: number;
    name: string;
  }[];
  const activity = (result.data.activity ?? []) as {
    at: string;
    kind: string;
    amountMinor: number;
  }[];
  return (
    <section className="pos-detail">
      <h2>{receipt.number}</h2>
      <p>
        {receipt.site} · {receipt.register} ·{" "}
        {receipt.payment?.provider ?? "Cash"}{" "}
        {refunds.length ? "with refunds" : "completed"}
      </p>
      <p>
        {new Date(receipt.createdAt).toLocaleString("en-US", {
          timeZone: receipt.timezone ?? "America/Phoenix",
        })}{" "}
        · {receipt.employeeName ?? "Operator"}
      </p>
      {receipt.lines.map((l, i) => (
        <article key={i}>
          <strong>{l.name}</strong>
          <span>
            {l.quantity} × {money(l.unitPriceMinor)}
          </span>
          <small>
            {[l.setCode, l.collectorNumber, l.condition, l.finish, l.language]
              .filter(Boolean)
              .join(" · ")}
          </small>
          <span>{money(l.lineTotalMinor)}</span>
        </article>
      ))}
      <p>
        Subtotal {money(receipt.subtotalMinor)} · Discount{" "}
        {money(receipt.discountMinor)} · Tax {money(receipt.taxMinor)}
      </p>
      <h3>Total {money(receipt.totalMinor)}</h3>
      <p>
        Cash {money(receipt.cashMinor)} · Change {money(receipt.changeMinor)}
      </p>
      <Link
        target="_blank"
        href={`/dashboard/pos/transactions/${saleId}/receipt`}
      >
        Print receipt →
      </Link>
      {refunds.map((r) => (
        <p key={r.id}>
          Refund {money(Number(r.total_minor))} · {r.reason}
        </p>
      ))}
      <details>
        <summary>Activity / audit</summary>
        {approval && (
          <p>
            Approved by {approval.name} · {approval.reason} ·{" "}
            {new Date(approval.at).toLocaleString("en-US", {
              timeZone: receipt.timezone ?? "America/Phoenix",
            })}
          </p>
        )}
        {movements.map((m, i) => (
          <p key={i}>
            Inventory: {m.name} · {m.quantity > 0 ? "+" : ""}
            {m.quantity} copies ·{" "}
            {new Date(m.at).toLocaleString("en-US", {
              timeZone: receipt.timezone ?? "America/Phoenix",
            })}
          </p>
        ))}
        {activity.map((e, i) => (
          <p key={i}>
            {new Date(e.at).toLocaleString("en-US", {
              timeZone: receipt.timezone ?? "America/Phoenix",
            })}{" "}
            · {e.kind.replaceAll("_", " ")} · {money(Number(e.amountMinor))}
          </p>
        ))}
      </details>
      <PaymentHistory saleId={saleId} />
      {context.ok && !bootstrap.response && (
        <RefundPanel
          saleId={saleId}
          items={result.data.items as RefundableItem[]}
          data={bootstrap.data as Bootstrap}
          scope={`${context.workspaceId}.${context.user!.id}`}
        />
      )}
    </section>
  );
}
