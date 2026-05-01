/**
 * Safe expression evaluator for amount inputs.
 * Supports + - * / parentheses and decimals.
 * Returns NaN on invalid input — never throws.
 */
export function evalExpr(input: string): number {
  if (!input) return NaN;
  const cleaned = input.replace(/\s|٬|,/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[-+*/().\d]+$/.test(cleaned)) return parseFloat(cleaned);
  // Reject double operators that aren't unary minus
  if (/[+*/]{2,}|--/.test(cleaned)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${cleaned});`)();
    return typeof v === "number" && isFinite(v) ? v : NaN;
  } catch {
    return NaN;
  }
}
