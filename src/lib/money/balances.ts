/**
 * Multi-currency balance calculation.
 * Each currency is kept STRICTLY SEPARATE — no mixing.
 */

export interface MoneyTx {
  amount: number;
  direction: string; // 'credit' | 'debit'
  currency_id: string;
  rate_at_tx?: number | null;
}

export interface OpeningBalance {
  currency_id: string;
  amount: number;
  direction: string;
}

export interface CurrencyLite {
  id: string;
  name: string;
  symbol: string;
  rate: number;
  is_base: boolean;
}

export interface PerCurrencyBalance {
  currency: CurrencyLite;
  balance: number;   // signed: + means له عندك (credit), - means عليه (debit)
  txCount: number;
  opening: number;
  baseEquivalent: number; // converted to base using CURRENT rate (display only)
}

/** Sign helper */
const sign = (dir: string) => (dir === "credit" ? 1 : -1);

/**
 * Compute one balance per currency, never mixing them.
 */
export function computeBalancesByCurrency(
  txs: MoneyTx[],
  currencies: CurrencyLite[],
  openings: OpeningBalance[] = [],
): PerCurrencyBalance[] {
  const map = new Map<string, PerCurrencyBalance>();
  for (const c of currencies) {
    map.set(c.id, { currency: c, balance: 0, txCount: 0, opening: 0, baseEquivalent: 0 });
  }
  for (const o of openings) {
    const slot = map.get(o.currency_id);
    if (!slot) continue;
    const v = Number(o.amount) * sign(o.direction);
    slot.opening += v;
    slot.balance += v;
  }
  for (const t of txs) {
    const slot = map.get(t.currency_id);
    if (!slot) continue;
    slot.balance += Number(t.amount) * sign(t.direction);
    slot.txCount += 1;
  }
  for (const slot of map.values()) {
    slot.baseEquivalent = slot.balance * (slot.currency.rate || 1);
  }
  // Only return currencies that have activity OR are the base
  return Array.from(map.values())
    .filter((s) => s.txCount > 0 || s.opening !== 0 || s.currency.is_base)
    .sort((a, b) => Number(b.currency.is_base) - Number(a.currency.is_base));
}

/**
 * Running balance PER currency (for timeline display).
 * Returns a map: txId -> running balance in that tx's own currency.
 */
export function computeRunningByCurrency(
  txs: (MoneyTx & { id: string; transaction_date: string })[],
  openings: OpeningBalance[] = [],
): Record<string, number> {
  const ordered = [...txs].sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime(),
  );
  const acc = new Map<string, number>();
  for (const o of openings) {
    acc.set(o.currency_id, (acc.get(o.currency_id) ?? 0) + Number(o.amount) * sign(o.direction));
  }
  const map: Record<string, number> = {};
  for (const t of ordered) {
    const prev = acc.get(t.currency_id) ?? 0;
    const next = prev + Number(t.amount) * sign(t.direction);
    acc.set(t.currency_id, next);
    map[t.id] = next;
  }
  return map;
}

/**
 * Aggregate per-currency totals across many people (for global dashboard).
 */
export function aggregateOwedOwePerCurrency(
  txs: MoneyTx[],
  currencies: CurrencyLite[],
): { currency: CurrencyLite; owed: number; owe: number; net: number }[] {
  const map = new Map<string, { owed: number; owe: number }>();
  for (const c of currencies) map.set(c.id, { owed: 0, owe: 0 });
  for (const t of txs) {
    const slot = map.get(t.currency_id);
    if (!slot) continue;
    if (t.direction === "credit") slot.owed += Number(t.amount);
    else slot.owe += Number(t.amount);
  }
  return currencies
    .map((c) => {
      const s = map.get(c.id)!;
      return { currency: c, owed: s.owed, owe: s.owe, net: s.owed - s.owe };
    })
    .filter((r) => r.owed > 0 || r.owe > 0 || r.currency.is_base)
    .sort((a, b) => Number(b.currency.is_base) - Number(a.currency.is_base));
}
