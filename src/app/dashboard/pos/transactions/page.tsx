import Link from "next/link";
import { posCommand } from "@/lib/pos/server";
import { money, type Bootstrap } from "@/lib/pos/domain";
type Sale = {
  payment_methods: string;
  id: string;
  receipt_number: string;
  created_at: string;
  total_minor: number;
  refunded_minor: number;
  timezone: string;
  site_name: string;
};
export default async function Transactions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const filters = await searchParams;
  const result = await posCommand("history", filters);
  const bootstrap = await posCommand("bootstrap", {});
  if (result.response)
    return <p role="alert">Transaction history is unavailable.</p>;
  const sales = result.data as Sale[];
  const data = bootstrap.data as Bootstrap | undefined;
  const older = new URLSearchParams({
    ...filters,
    before: sales.at(-1)?.created_at ?? "",
    beforeId: sales.at(-1)?.id ?? "",
  });
  return (
    <>
      <h2>Transactions</h2>
      <p>
        Dates follow each store’s timezone. Cashiers see their own transactions;
        managers see authorized stores.
      </p>
      <form className="pos-form-grid">
        <label>
          Period
          <select name="period" defaultValue={filters.period ?? "all"}>
            <option value="all">All / custom</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Store
          <select name="siteId" defaultValue={filters.siteId ?? ""}>
            <option value="">All authorized stores</option>
            {data?.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Register
          <select name="registerId" defaultValue={filters.registerId ?? ""}>
            <option value="">All registers</option>
            {data?.registers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Employee
          <select name="actorId" defaultValue={filters.actorId ?? ""}>
            <option value="">All permitted employees</option>
            {data?.operators?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="refunded">Has refunds</option>
          </select>
        </label>
        <label>
          Payment
          <select name="payment">
            <option value="cash">Cash</option>
            {process.env.NODE_ENV !== "production" && (
              <option value="mock">Mock</option>
            )}
            <option value="external">External</option>
          </select>
        </label>
        <label>
          Receipt, product or SKU
          <input name="query" defaultValue={filters.query} maxLength={160} />
        </label>
        <button>Apply filters</button>
      </form>
      <div className="pos-history">
        {sales.map((s) => (
          <Link key={s.id} href={`/dashboard/pos/transactions/${s.id}`}>
            <span>
              <strong>{s.receipt_number}</strong>
              <small>
                {new Date(s.created_at).toLocaleString("en-US", {
                  timeZone: s.timezone,
                })}{" "}
                · {s.site_name} · {s.payment_methods} ·{" "}
                {Number(s.refunded_minor)
                  ? "Refunded / partially refunded"
                  : "Completed"}
              </small>
            </span>
            <b>{money(s.total_minor)}</b>
          </Link>
        ))}
      </div>
      {!sales.length && <p>No completed sales in this period.</p>}
      {sales.length === 50 && (
        <Link href={`/dashboard/pos/transactions?${older}`}>
          Older transactions →
        </Link>
      )}
    </>
  );
}
