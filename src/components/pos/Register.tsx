'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { addScan, money, parseMinor, previewLine, type Bootstrap, type CartLine, type PosItem, type Receipt } from '@/lib/pos/domain';
import { posRead, posWrite } from '@/lib/pos/client';
import { createScanner } from '@/lib/pos/scanner';

type Completion = { status: string; saleId?: string; receipt?: Receipt };
type Pending = { key: string; siteId: string; sessionId: string; expectedMinor: number; cashMinor: number; discountReason: string; lines: { itemId: string; quantity: number; discountBps: number; positionId?: string }[] };

export function Register({ data, workspaceId, actorId }: { data: Bootstrap; workspaceId: string; actorId: string }) {
  const [registerId, setRegisterId] = useState(data.registers[0]?.id ?? '');
  const [sessions, setSessions] = useState(data.sessions);
  const [cart, setCart] = useState<CartLine[]>([]); const cartRef = useRef(cart);
  const [query, setQuery] = useState(''); const [results, setResults] = useState<PosItem[]>([]);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [message, setMessage] = useState('Ready to scan'); const [busy, setBusy] = useState(false);
  const [cash, setCash] = useState(''); const [reason, setReason] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [completed, setCompleted] = useState<Completion | null>(null);
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);
  const [scanning, setScanning] = useState(0);
  const [recoveryBlocked, setRecoveryBlocked] = useState(false);
  const queue = useRef(Promise.resolve()); const searchVersion = useRef(0); const inFlight = useRef(false);
  const scanCount = useRef(0);
  const storageKey = `td.pos.pending.${workspaceId}.${actorId}`;
  const register = data.registers.find(r => r.id === registerId);
  const site = data.sites.find(s => s.id === register?.site_id);
  const session = sessions.find(s => s.register_id === registerId);
  const locked = busy || pending !== null || recoveryBlocked;
  function updateCart(next: CartLine[]) { cartRef.current = next; setCart(next); setCompleted(null); }

  useEffect(() => {
    let active = true;
    // Restore browser-owned state after hydration; fresh checkout stays disabled
    // until restoration finishes. Cleanup prevents applying another workspace's state.
    queueMicrotask(() => {
    if (!active) return;
    try { const raw = localStorage.getItem(storageKey); if (raw) {
      const saved = JSON.parse(raw);
      if (typeof saved?.key !== 'string' || !Array.isArray(saved?.lines) || typeof saved?.sessionId !== 'string') throw new Error('Invalid saved checkout');
      setPending(saved);
    } }
    catch { setRecoveryBlocked(true); setMessage('Checkout recovery could not be loaded. Check transaction history before taking payment.'); }
    setRestored(true);
    setOnline(navigator.onLine);
    });
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync); window.addEventListener('offline', sync);
    return () => { active = false; window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, [storageKey]);

  const add = useCallback((item: PosItem) => {
    try { const next = addScan(cartRef.current, item); cartRef.current = next; setCart(next); setCompleted(null); setMessage(`Added ${item.name}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Item unavailable.'); }
  }, []);
  const scan = useCallback((barcode: string) => {
    if (!site || locked || !online) return;
    scanCount.current++; setScanning(scanCount.current);
    queue.current = queue.current.then(async () => {
      try {
        const value = barcode.match(/^(?:https:\/\/(?:www\.)?tradingdocks\.com)?\/q\/([A-Za-z0-9]+)$/)?.[1] ?? barcode;
        const found = await posRead<PosItem[]>('search', { siteId: site.id, query: value, exact: 'true' });
        setUnknownBarcode(found.length ? "" : value);
        if (found.length === 1) add(found[0]);
        else { setResults([]); setMessage(found.length ? 'Barcode mapping needs attention. Ask a manager to review it.' : 'Barcode not found at this location. Search inventory below.'); }
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Scan failed.'); }
      finally { scanCount.current--; setScanning(scanCount.current); }
    });
  }, [site, locked, online, add]);
  useEffect(() => {
    const controller = createScanner(scan);
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && Boolean(target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'));
      controller(event, editing);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [scan]);

  const totals = cart.reduce((sum, line) => {
    const v = previewLine(line.item.unit_price_minor ?? 0, line.quantity, line.discountBps, line.item.taxable === false ? 0 : site?.tax_bps ?? 0);
    return { subtotal: sum.subtotal + v.subtotal, discount: sum.discount + v.discount, tax: sum.tax + v.tax, total: sum.total + v.total };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });
  async function search(value: string) {
    setQuery(value); const version = ++searchVersion.current;
    if (!site || value.trim().length < 2) { setResults([]); return; }
    try { const items = await posRead<PosItem[]>('search', { siteId: site.id, query: value.trim() }); if (version === searchVersion.current) setResults(items); }
    catch (error) { if (version === searchVersion.current) setMessage(error instanceof Error ? error.message : 'Search unavailable.'); }
  }
  function finish(result: Completion) {
    if (result.status === 'canceled') { localStorage.removeItem(storageKey); setPending(null); setMessage('Checkout canceled without a sale. Return any cash already taken, then review the cart.'); return; }
    if (result.status !== 'completed') { setMessage('No completed sale found. Retry the saved checkout with the same reference.'); return; }
    localStorage.removeItem(storageKey); setPending(null); updateCart([]); setCompleted(result); setCash(''); setReason(''); setResults([]); setQuery(''); setMessage('Sale completed. Ready for the next customer.');
  }
  async function checkout() {
    if (inFlight.current || scanCount.current || recoveryBlocked || !site || (!session && !pending)) return;
    const cashMinor = parseMinor(cash);
    if (!pending && (cashMinor === null || cashMinor < totals.total || !cart.length)) { setMessage('Enter enough cash to cover the total.'); return; }
    inFlight.current = true; setBusy(true);
    const command: Pending = pending ?? { key: crypto.randomUUID(), siteId: site.id, sessionId: session!.id, expectedMinor: totals.total, cashMinor: cashMinor!, discountReason: reason, lines: cart.map(l => ({ itemId: l.item.id, quantity: l.quantity, discountBps: l.discountBps, positionId: l.positionId })) };
    try {
      // Persist original intent BEFORE sending, so refresh/network retry cannot invent a second sale.
      localStorage.setItem(storageKey, JSON.stringify(command)); setPending(command);
      finish(await posWrite<Completion>('checkout', command));
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      // Only documented rejection codes mean the transaction did not commit.
      if (!pending && ['POS_STOCK_UNAVAILABLE','POS_PROVENANCE_CONFLICT','POS_QUOTE_CHANGED','POS_PRICE_REQUIRED','POS_CASH_INSUFFICIENT','POS_SESSION_CLOSED','POS_DISCOUNT_REASON','POS_INVALID','POS_FORBIDDEN','POS_DISABLED'].includes(code)) {
        localStorage.removeItem(storageKey); setPending(null);
      }
      setMessage(error instanceof Error ? error.message : 'Connection lost. Check the saved checkout before taking payment again.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  if (!data.registers.length) return <div className="pos-empty"><h2>Set up your first register</h2><p>Map existing inventory storage to a store location and confirm tax before taking a sale.</p><Link href="/dashboard/pos/setup">Set up POS →</Link></div>;
  return <>
    <div className="pos-toolbar">
      <label>Register<select value={registerId} disabled={locked || scanning > 0 || cart.length > 0} onChange={e => { ++searchVersion.current; setResults([]); setQuery(''); setRegisterId(e.target.value); }}>{data.registers.map(r => <option key={r.id} value={r.id}>{data.sites.find(s => s.id === r.site_id)?.name} · {r.name}</option>)}</select></label>
      <button disabled={locked || scanning > 0 || cart.length > 0} onClick={async () => {
        setBusy(true);
        try {
          if (session) { await posWrite('close', { registerId }); setSessions(s => s.filter(x => x.id !== session.id)); }
          else { const opened = await posWrite<Bootstrap['sessions'][number]>('open', { registerId }); setSessions(s => [...s, opened]); }
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Register unavailable.'); }
        finally { setBusy(false); }
      }}>{session ? 'Close register' : 'Open register'}</button>
      <span>{online ? 'Online · Cash' : 'Offline · Checkout unavailable'}</span>
    </div>
    <p className="pos-status" role="status" aria-live="polite">{message}</p>
    {unknownBarcode && <div className="pos-recovery"><strong>Barcode not found</strong><code>{unknownBarcode}</code><button onClick={() => { setQuery(''); setResults([]); document.querySelector<HTMLInputElement>('.pos-search-label input')?.focus(); }}>Search Inventory</button>{data.canManage && <Link href={`/dashboard/label-studio?source=pos&barcode=${encodeURIComponent(unknownBarcode)}`}>Assign Barcode</Link>}<button onClick={() => setUnknownBarcode('')}>Cancel</button></div>}
    {scanning > 0 && <p role="status">Resolving {scanning} scan(s)…</p>}
    {recoveryBlocked && <p role="alert">Saved checkout recovery requires review. Open <Link href="/dashboard/pos/transactions">transaction history</Link> before starting another sale.</p>}
    {pending && <div className="pos-recovery"><strong>Checkout needs confirmation</strong><p>Keep this checkout reference. Do not take a second payment.</p><code>{pending.key}</code><button disabled={busy || !online} onClick={async () => { setBusy(true); try { finish(await posRead<Completion>('recover', { key: pending.key })); } catch (error) { setMessage(error instanceof Error ? error.message : 'Cannot check status.'); } finally { setBusy(false); } }}>Check checkout status</button><button disabled={busy || !online} onClick={checkout}>Retry original checkout</button><button disabled={busy || !online} onClick={async () => { setBusy(true); try { finish(await posWrite<Completion>('cancel', { key: pending.key })); } catch (error) { setMessage(error instanceof Error ? error.message : 'Cannot cancel checkout.'); } finally { setBusy(false); } }}>Cancel uncompleted checkout</button></div>}
    {completed?.receipt && <div className="pos-success"><strong>Paid {money(completed.receipt.totalMinor)} · Change {money(completed.receipt.changeMinor)}</strong><Link target="_blank" href={`/dashboard/pos/transactions/${completed.saleId}/receipt`}>Print receipt</Link></div>}
    <div className="pos-register-grid"><section aria-label="Inventory and cart">
      <form onSubmit={e => { e.preventDefault(); scan(query); }}><label className="pos-search-label">Scan barcode or search inventory<input autoComplete="off" value={query} disabled={locked} onChange={e => void search(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setResults([]); } }} placeholder="Card name, set, number, SKU or barcode" /></label></form>
      {results.length > 0 && <div className="pos-results">{results.map(item => <button key={item.id} disabled={locked || item.available < 1 || item.unit_price_minor === null} onClick={() => add(item)}><span><strong>{item.name}</strong><small>{[item.set_code, item.collector_number, item.condition, item.finish, item.language].filter(Boolean).join(' · ')}</small><small>{item.location} · {item.available} available · {item.positions.length} batch positions</small></span><b>{item.unit_price_minor === null ? 'Price required' : money(item.unit_price_minor)}</b></button>)}</div>}
      <div className="pos-cart-heading"><h2>Current sale</h2><span>{cart.reduce((n,l) => n+l.quantity,0)} items</span><button disabled={locked || scanning > 0 || !cart.length} onClick={async () => {
        if (!site) return; setBusy(true);
        try {
          const refreshed = await Promise.all(cart.map(async line => {
            const found = await posRead<PosItem[]>('search', { siteId: site.id, query: line.item.barcodeIdentity ? line.item.sku : line.item.id, exact: 'true' });
            return { ...line, item: found.find(item => item.id === line.item.id) ?? { ...line.item, available: 0 } };
          }));
          updateCart(refreshed); setMessage('Prices and stock refreshed. Remove unavailable items and confirm the total.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Refresh failed.'); } finally { setBusy(false); }
      }}>Refresh prices & stock</button></div>
      {!cart.length && <div className="pos-empty"><h3>Ready for the first item</h3><p>Scan a label or search your inventory. Repeated scans add another copy.</p></div>}
      {cart.map(line => <article className="pos-cart-line" key={`${line.item.id}:${line.positionId ?? ""}`}><div><strong>{line.item.name}</strong><small>{[line.item.set_code,line.item.collector_number,line.item.condition,line.item.finish,line.item.language].filter(Boolean).join(' · ')}</small><small>{line.item.location} · {line.item.sku}</small>
        {(line.item.available < line.quantity || line.item.unit_price_minor === null) && <small role="alert">Unavailable at this quantity or missing price</small>}
        {line.item.positions.length > 0 && <label>Batch position<select value={line.positionId ?? ''} disabled={locked || Boolean(line.item.positionId)} onChange={e => updateCart(cart.map(l => l === line ? { ...l, positionId: e.target.value || undefined } : l))}><option value="">Oldest available at this location</option>{line.item.positions.map(p => <option key={p.id} value={p.id}>{p.id} · {p.quantity} copies</option>)}</select></label>}
        {data.canManage && <label>Discount %<input type="number" min="0" max="100" step="1" value={line.discountBps / 100} disabled={locked} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 100) updateCart(cart.map(l => l === line ? { ...l, discountBps: n * 100 } : l)); }} /></label>}
      </div><label>Quantity<input type="number" min="1" max={Math.min(line.item.available,1000)} value={line.quantity} disabled={locked} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n > 0 && n <= Math.min(line.item.available,1000)) updateCart(cart.map(l => l === line ? { ...l, quantity: n } : l)); }} /></label><strong>{money(previewLine(line.item.unit_price_minor!,line.quantity,line.discountBps,0).total)}</strong><button aria-label={`Remove ${line.item.name}`} disabled={locked} onClick={() => updateCart(cart.filter(l => l !== line))}>Remove</button></article>)}
    </section><aside className="pos-checkout" aria-label="Cash checkout"><h2>Checkout</h2><p>Guest · {site?.name}</p><dl><div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>Discount</dt><dd>−{money(totals.discount)}</dd></div><div><dt>Tax ({(site?.tax_bps ?? 0)/100}%)</dt><dd>{money(totals.tax)}</dd></div><div className="pos-total"><dt>Total</dt><dd>{money(totals.total)}</dd></div></dl>
      {totals.discount > 0 && <label>Discount reason<input maxLength={200} value={reason} disabled={locked} onChange={e => setReason(e.target.value)} /></label>}
      <label>Cash received<input inputMode="decimal" value={cash} disabled={locked} onChange={e => setCash(e.target.value)} placeholder="0.00" /></label><div className="pos-cash-shortcuts">{[totals.total,Math.ceil(totals.total/1000)*1000,5000,10000].filter((v,i,a) => v >= totals.total && a.indexOf(v)===i).map(n => <button key={n} disabled={locked} onClick={() => setCash((n/100).toFixed(2))}>{n===totals.total ? 'Exact' : money(n)}</button>)}</div>
      <p>Change <strong>{money(Math.max(0,(parseMinor(cash)??0)-totals.total))}</strong></p><button className="pos-primary" disabled={locked || scanning > 0 || !restored || !online || !session || !cart.length || cart.some(l => l.item.available < l.quantity || l.item.unit_price_minor === null)} onClick={checkout}>{busy ? 'Completing…' : 'Complete cash sale'}</button><small>Prices, stock and tax are checked again when the sale completes.</small>
    </aside></div>
  </>;
}
