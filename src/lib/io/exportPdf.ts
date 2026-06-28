import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

/**
 * Arabic-safe PDF pipeline.
 *
 * We render a styled HTML document (RTL, Tajawal/Cairo via Google Fonts already
 * loaded in __root.tsx) into an offscreen DOM node, capture it with html2canvas,
 * then paginate the resulting bitmap into a jsPDF A4 document. This guarantees
 * correct Arabic shaping, RTL, mixed Arabic/English on the same line, and
 * identical rendering across Acrobat / Chrome / Edge / Firefox / iOS / Android.
 */

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}
function fmtInt(n: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(n);
}
function dmy(d: string | Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}
function esc(s: string | null | undefined) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

interface Tx { amount: number; direction: string; transaction_date: string; details: string | null; currency_id: string }
interface Currency { id: string; name: string; symbol: string; rate: number; is_base?: boolean }
interface OpeningBalance { currency_id: string; amount: number; direction: string }

interface CompanyInfo {
  name?: string | null; address?: string | null; phone?: string | null;
  email?: string | null; tax_number?: string | null; notes?: string | null;
  logo_path?: string | null;
}

async function fetchCompany(): Promise<CompanyInfo | null> {
  const { data } = await supabase.from("company_profile").select("*").maybeSingle();
  return data ?? null;
}

async function logoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

/** Ensure the Arabic web font is fully loaded before capturing. */
async function ensureArabicFontLoaded() {
  try {
    const f: FontFaceSet | undefined = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!f) return;
    await Promise.all([
      f.load('700 16px "Tajawal"'),
      f.load('500 14px "Tajawal"'),
      f.load('400 12px "Tajawal"'),
    ]);
    await f.ready;
  } catch { /* ignore */ }
}

const C = {
  primary: "#1d4ed8",
  primarySoft: "#dbeafe",
  accent: "#059669",
  accentSoft: "#d1fae5",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  bgAlt: "#f9fafb",
  white: "#ffffff",
};

function statusFor(closing: number): { label: string; bg: string } {
  if (closing > 0) return { label: "رصيد لكم (له عندك)", bg: C.accent };
  if (closing < 0) return { label: "رصيد عليكم", bg: C.danger };
  return { label: "مسددة بالكامل", bg: C.muted };
}

export async function exportPersonStatementPDF(opts: {
  personName: string;
  phone?: string | null;
  txs: Tx[];
  currencies: Currency[];
  openings?: OpeningBalance[];
  balance?: number;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}) {
  const { personName, phone, txs, currencies, openings = [], dateFrom, dateTo } = opts;
  const company = await fetchCompany();
  const logo = company?.logo_path ? await logoDataUrl(company.logo_path) : null;
  await ensureArabicFontLoaded();

  // Period filter
  const filteredTxs = txs.filter((t) => {
    const d = new Date(t.transaction_date).getTime();
    if (dateFrom && d < dateFrom.getTime()) return false;
    if (dateTo && d > dateTo.getTime()) return false;
    return true;
  });

  // Currencies in scope
  const used = currencies.filter((c) =>
    filteredTxs.some((t) => t.currency_id === c.id) || openings.some((o) => o.currency_id === c.id),
  );
  if (used.length === 0 && currencies.length > 0) used.push(currencies[0]);
  used.sort((a, b) => Number(b.is_base) - Number(a.is_base));

  // KPIs in base currency
  let totalCredit = 0, totalDebit = 0;
  for (const t of filteredTxs) {
    const r = currencies.find((c) => c.id === t.currency_id)?.rate ?? 1;
    if (t.direction === "credit") totalCredit += Number(t.amount) * r;
    else totalDebit += Number(t.amount) * r;
  }
  const base = currencies.find((c) => c.is_base) ?? currencies[0];
  const baseSym = base?.symbol ?? "";

  // Build per-currency sections HTML
  const sections = used.map((cur) => {
    const open = openings.filter((o) => o.currency_id === cur.id)
      .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);
    const curTxs = [...filteredTxs.filter((t) => t.currency_id === cur.id)]
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    if (curTxs.length === 0 && open === 0) return "";

    let acc = open;
    let cCredit = 0, cDebit = 0;
    const rows: string[] = [];

    if (open !== 0) {
      rows.push(`
        <tr style="background:${C.primarySoft};">
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">—</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">0</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:right;font-weight:700;">رصيد افتتاحي</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;">${open > 0 ? fmt(Math.abs(open)) : "—"}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;">${open < 0 ? fmt(Math.abs(open)) : "—"}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;font-weight:700;">${fmt(open)}</td>
        </tr>`);
    }

    curTxs.forEach((t, i) => {
      const amt = Number(t.amount);
      if (t.direction === "credit") { acc += amt; cCredit += amt; }
      else { acc -= amt; cDebit += amt; }
      const zebra = i % 2 === 1 ? C.bgAlt : C.white;
      const desc = t.details ?? (t.direction === "credit" ? "دائن" : "مدين");
      rows.push(`
        <tr style="background:${zebra};">
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;white-space:nowrap;">${dmy(t.transaction_date)}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:center;">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:right;">${esc(desc)}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;white-space:nowrap;">${t.direction === "credit" ? fmt(amt) : "—"}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;white-space:nowrap;">${t.direction === "debit"  ? fmt(amt) : "—"}</td>
          <td style="padding:6px 8px;border:1px solid ${C.border};text-align:left;font-weight:700;white-space:nowrap;">${fmt(acc)}</td>
        </tr>`);
    });

    const closing = open + cCredit - cDebit;
    const st = statusFor(closing);

    return `
      <section style="margin-top:14px;page-break-inside:auto;">
        <div style="background:${C.primary};color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:13px;">${esc(cur.name)} <span style="opacity:.85;">(${esc(cur.symbol)})</span></div>
          <div style="font-size:11px;opacity:.9;">قسم العملة</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;table-layout:auto;">
          <thead>
            <tr style="background:${C.primary};color:#fff;">
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:center;width:78px;">التاريخ</th>
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:center;width:30px;">#</th>
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:right;">البيان / الوصف</th>
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:90px;">دائن (له)</th>
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:90px;">مدين (عليه)</th>
              <th style="padding:7px 8px;border:1px solid ${C.primary};text-align:left;width:100px;">الرصيد (${esc(cur.symbol)})</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
          <tfoot>
            <tr style="background:${C.bgAlt};font-weight:700;">
              <td colspan="3" style="padding:7px 8px;border:1px solid ${C.border};text-align:right;">الإجماليات</td>
              <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;color:${C.accent};">${fmt(cCredit)}</td>
              <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;color:${C.danger};">${fmt(cDebit)}</td>
              <td style="padding:7px 8px;border:1px solid ${C.border};text-align:left;">${fmt(closing)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="background:${st.bg};color:#fff;padding:8px 12px;border-radius:0 0 6px 6px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:12px;">${st.label}</div>
          <div style="font-weight:800;font-size:13px;">${fmt(Math.abs(closing))} ${esc(cur.symbol)}</div>
        </div>
      </section>`;
  }).join("");

  const periodLabel = (dateFrom || dateTo)
    ? `الفترة: ${dateFrom ? dmy(dateFrom) : "—"} ← ${dateTo ? dmy(dateTo) : "—"}`
    : "";

  const html = `
    <div id="__statement_root" dir="rtl" lang="ar" style="
      width: 794px; padding: 28px; background: #fff; color: ${C.text};
      font-family: 'Tajawal','Cairo','Noto Sans Arabic','IBM Plex Sans Arabic','Segoe UI',Arial,sans-serif;
      font-size: 12px; line-height: 1.55; -webkit-font-smoothing: antialiased;">

      <!-- Brand header -->
      <div style="background:${C.primary};color:#fff;padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logo ? `<img src="${logo}" style="width:48px;height:48px;border-radius:8px;background:#fff;object-fit:contain;padding:3px;" crossorigin="anonymous" />` : ""}
          <div>
            <div style="font-size:18px;font-weight:800;">${esc(company?.name) || "دفترك"}</div>
            <div style="font-size:10.5px;opacity:.9;margin-top:2px;">
              ${[company?.phone && `هاتف: ${esc(company.phone)}`, company?.email && esc(company.email), company?.tax_number && `الرقم الضريبي: ${esc(company.tax_number)}`].filter(Boolean).join("  •  ")}
            </div>
            ${company?.address ? `<div style="font-size:10.5px;opacity:.85;margin-top:2px;">${esc(company.address)}</div>` : ""}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:16px;font-weight:800;">كشف حساب</div>
          <div style="font-size:10.5px;opacity:.9;">Statement of Account</div>
          <div style="font-size:10.5px;opacity:.9;margin-top:3px;">التاريخ: ${dmy(new Date())}</div>
        </div>
      </div>

      <!-- Customer box -->
      <div style="margin-top:12px;background:${C.primarySoft};border:1px solid ${C.primary};border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10.5px;color:${C.muted};">العميل</div>
          <div style="font-size:14px;font-weight:800;">${esc(personName)}</div>
        </div>
        ${phone ? `<div style="text-align:left;">
          <div style="font-size:10.5px;color:${C.muted};">رقم الهاتف</div>
          <div style="font-size:13px;font-weight:700;direction:ltr;">${esc(phone)}</div>
        </div>` : ""}
      </div>

      ${periodLabel ? `<div style="margin-top:8px;font-size:10.5px;color:${C.muted};font-style:italic;">${periodLabel}</div>` : ""}

      <!-- KPIs -->
      <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div style="border:1px solid ${C.border};background:${C.accentSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">إجمالي الدائن (${esc(baseSym)})</div>
          <div style="font-size:14px;font-weight:800;color:${C.accent};margin-top:2px;">${fmt(totalCredit)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.dangerSoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">إجمالي المدين (${esc(baseSym)})</div>
          <div style="font-size:14px;font-weight:800;color:${C.danger};margin-top:2px;">${fmt(totalDebit)}</div>
        </div>
        <div style="border:1px solid ${C.border};background:${C.primarySoft};border-radius:6px;padding:8px 10px;">
          <div style="font-size:10px;color:${C.muted};">عدد المعاملات</div>
          <div style="font-size:14px;font-weight:800;color:${C.primary};margin-top:2px;">${fmtInt(filteredTxs.length)}</div>
        </div>
      </div>

      ${sections || `<div style="margin-top:20px;padding:24px;text-align:center;color:${C.muted};border:1px dashed ${C.border};border-radius:6px;">لا توجد معاملات ضمن الفترة المحددة</div>`}

      ${company?.notes ? `
        <div style="margin-top:14px;padding:10px 12px;border:1px solid ${C.border};border-radius:6px;background:${C.bgAlt};">
          <div style="font-size:10.5px;color:${C.muted};font-weight:700;margin-bottom:4px;">ملاحظات</div>
          <div style="font-size:11px;white-space:pre-wrap;">${esc(company.notes)}</div>
        </div>` : ""}

      <div style="margin-top:18px;border-top:1px solid ${C.border};padding-top:8px;display:flex;justify-content:space-between;color:${C.muted};font-size:10px;">
        <div>تم إنشاء هذا الكشف بواسطة دفترك  •  Daftarak</div>
        <div>${new Date().toLocaleString("ar-EG")}</div>
      </div>
    </div>`;

  // Mount offscreen
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:auto auto 0 -10000px;width:794px;z-index:-1;pointer-events:none;opacity:0;";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    // Wait one paint so fonts + images apply
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

    const node = host.firstElementChild as HTMLElement;
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, imgH, undefined, "FAST");
    } else {
      // Slice the bitmap per page to avoid huge negative-offset rendering blur
      const pxPerMm = canvas.width / pageW;
      const pageHpx = Math.floor(pageH * pxPerMm);
      let y = 0;
      let first = true;
      while (y < canvas.height) {
        const sliceH = Math.min(pageHpx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceImgH = (sliceH * imgW) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, sliceImgH, undefined, "FAST");
        first = false;
        y += sliceH;
      }
    }

    // Footer page numbers (Latin glyphs render via built-in fonts safely)
    const pageCount = (pdf as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`Page ${p} / ${pageCount}`, pageW - 10, pageH - 5, { align: "right" });
    }

    pdf.save(`statement-${personName}-${Date.now()}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}
