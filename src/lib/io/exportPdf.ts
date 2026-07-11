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
  primary: "#0f172a",       // Dark slate for a premium look
  primarySoft: "#f1f5f9",   // Light slate
  accent: "#16a34a",        // Green
  accentSoft: "#dcfce7",
  danger: "#ef4444",        // Red
  dangerSoft: "#fee2e2",
  text: "#334155",          // Slate 700
  muted: "#64748b",         // Slate 500
  border: "#e2e8f0",        // Slate 200
  bgAlt: "#f8fafc",         // Slate 50
  white: "#ffffff",
};

function statusFor(closing: number): { label: string; bg: string; color: string } {
  if (closing > 0) return { label: "الرصيد الإجمالي لكم (دائن)", bg: C.accentSoft, color: C.accent };
  if (closing < 0) return { label: "الرصيد الإجمالي عليكم (مدين)", bg: C.dangerSoft, color: C.danger };
  return { label: "الرصيد مسدد بالكامل", bg: C.primarySoft, color: C.text };
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
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">—</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">0</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:right;font-weight:700;">رصيد افتتاحي</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;">${open > 0 ? fmt(Math.abs(open)) : "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;">${open < 0 ? fmt(Math.abs(open)) : "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;font-weight:800;">${fmt(open)}</td>
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
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:center;white-space:nowrap;">${dmy(t.transaction_date)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:center;color:${C.muted};">${i + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:right;color:${C.text};">${esc(desc)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;color:${C.accent};font-weight:700;white-space:nowrap;">${t.direction === "credit" ? fmt(amt) : "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;color:${C.danger};font-weight:700;white-space:nowrap;">${t.direction === "debit"  ? fmt(amt) : "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${C.border};text-align:left;font-weight:800;white-space:nowrap;color:${C.primary};">${fmt(acc)}</td>
        </tr>`);
    });

    const closing = open + cCredit - cDebit;
    const st = statusFor(closing);

    return `
      <section style="margin-top:24px;page-break-inside:avoid;border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
        <!-- Table Header -->
        <div style="background:${C.primary};color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px;">
            <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:4px;font-size:12px;">عملة الكشف</span>
            ${esc(cur.name)} (${esc(cur.symbol)})
          </div>
        </div>
        
        <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:auto;">
          <thead>
            <tr style="background:${C.primarySoft};color:${C.text};border-bottom:2px solid ${C.border};">
              <th style="padding:10px 12px;text-align:center;width:80px;font-weight:700;">التاريخ</th>
              <th style="padding:10px 12px;text-align:center;width:40px;font-weight:700;">#</th>
              <th style="padding:10px 12px;text-align:right;font-weight:700;">البيان / الوصف</th>
              <th style="padding:10px 12px;text-align:left;width:100px;font-weight:700;">دائن (لكم)</th>
              <th style="padding:10px 12px;text-align:left;width:100px;font-weight:700;">مدين (عليكم)</th>
              <th style="padding:10px 12px;text-align:left;width:110px;font-weight:800;">الرصيد (${esc(cur.symbol)})</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
          <tfoot>
            <tr style="background:${C.bgAlt};border-top:2px solid ${C.border};">
              <td colspan="3" style="padding:12px;text-align:right;font-weight:800;color:${C.muted};">إجمالي الحركات</td>
              <td style="padding:12px;text-align:left;color:${C.accent};font-weight:800;">${fmt(cCredit)}</td>
              <td style="padding:12px;text-align:left;color:${C.danger};font-weight:800;">${fmt(cDebit)}</td>
              <td style="padding:12px;text-align:left;font-weight:800;"></td>
            </tr>
          </tfoot>
        </table>

        <!-- Final Balance Highlight -->
        <div style="background:${st.bg};padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${C.border};">
          <div style="font-weight:700;font-size:14px;color:${st.color};">${st.label}</div>
          <div style="font-weight:900;font-size:18px;color:${st.color};">${fmt(Math.abs(closing))} ${esc(cur.symbol)}</div>
        </div>
      </section>`;
  }).join("");

  const periodLabel = (dateFrom || dateTo)
    ? `من: ${dateFrom ? dmy(dateFrom) : "بداية السجلات"}  إلى: ${dateTo ? dmy(dateTo) : "تاريخ اليوم"}`
    : "";

  const html = `
    <div id="__statement_root" dir="rtl" lang="ar" style="
      width: 794px; min-height: 1122px; padding: 40px; background: #fff; color: ${C.text};
      font-family: 'Tajawal','Cairo',Arial,sans-serif;
      font-size: 13px; line-height: 1.6; -webkit-font-smoothing: antialiased; box-sizing: border-box;">

      <!-- Professional Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${C.primary};padding-bottom:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:16px;">
          ${logo ? `<img src="${logo}" style="width:64px;height:64px;border-radius:12px;object-fit:contain;border:1px solid ${C.border};padding:4px;" crossorigin="anonymous" />` : ""}
          <div>
            <div style="font-size:24px;font-weight:900;color:${C.primary};letter-spacing:-0.5px;">${esc(company?.name) || "دفترك"}</div>
            ${company?.address ? `<div style="font-size:12px;color:${C.muted};margin-top:4px;">${esc(company.address)}</div>` : ""}
            <div style="font-size:12px;color:${C.muted};margin-top:2px;display:flex;gap:12px;">
              ${company?.phone ? `<span>📞 ${esc(company.phone)}</span>` : ""}
              ${company?.email ? `<span>✉️ ${esc(company.email)}</span>` : ""}
            </div>
            ${company?.tax_number ? `<div style="font-size:12px;color:${C.muted};margin-top:2px;">الرقم الضريبي: ${esc(company.tax_number)}</div>` : ""}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:28px;font-weight:900;color:${C.primary};text-transform:uppercase;letter-spacing:1px;">كشف حساب</div>
          <div style="font-size:14px;color:${C.muted};font-weight:700;margin-top:4px;">STATEMENT OF ACCOUNT</div>
          <div style="margin-top:12px;background:${C.primarySoft};padding:6px 12px;border-radius:6px;display:inline-block;border:1px solid ${C.border};">
            <div style="font-size:11px;color:${C.muted};font-weight:700;">تاريخ الإصدار</div>
            <div style="font-size:13px;font-weight:800;color:${C.primary};">${dmy(new Date())}</div>
          </div>
        </div>
      </div>

      <!-- Customer & Period Info Box -->
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:2;background:${C.bgAlt};border:1px solid ${C.border};border-radius:8px;padding:16px;">
          <div style="font-size:11px;color:${C.muted};font-weight:700;text-transform:uppercase;">تفاصيل العميل</div>
          <div style="font-size:18px;font-weight:900;color:${C.primary};margin-top:4px;">${esc(personName)}</div>
          ${phone ? `<div style="font-size:13px;color:${C.text};margin-top:4px;direction:ltr;text-align:right;">${esc(phone)} 📞</div>` : ""}
        </div>
        <div style="flex:1;background:${C.bgAlt};border:1px solid ${C.border};border-radius:8px;padding:16px;display:flex;flex-direction:column;justify-content:center;">
          <div style="font-size:11px;color:${C.muted};font-weight:700;text-transform:uppercase;">فترة الكشف</div>
          <div style="font-size:13px;font-weight:800;color:${C.primary};margin-top:4px;">${periodLabel || "تاريخ مفتوح"}</div>
          <div style="font-size:11px;color:${C.muted};margin-top:8px;">إجمالي الحركات: <strong style="color:${C.primary};">${fmtInt(filteredTxs.length)}</strong></div>
        </div>
      </div>

      <!-- Sections -->
      ${sections || `<div style="margin-top:32px;padding:40px;text-align:center;color:${C.muted};border:2px dashed ${C.border};border-radius:12px;background:${C.bgAlt};font-size:15px;font-weight:700;">لا توجد معاملات مسجلة في هذه الفترة</div>`}

      <!-- Footer Notes -->
      ${company?.notes ? `
        <div style="margin-top:32px;padding:16px;border:1px solid ${C.border};border-radius:8px;background:${C.bgAlt};border-right:4px solid ${C.primary};">
          <div style="font-size:12px;color:${C.primary};font-weight:800;margin-bottom:6px;">ملاحظات هامة</div>
          <div style="font-size:12px;color:${C.text};white-space:pre-wrap;line-height:1.6;">${esc(company.notes)}</div>
        </div>` : ""}

      <!-- Bottom Signature & Branding -->
      <div style="margin-top:48px;padding-top:16px;border-top:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center;color:${C.muted};font-size:11px;">
        <div>
          <span>صدر بواسطة نظام <strong>دفترك</strong> للإدارة المالية</span>
        </div>
        <div style="text-align:left;">
          <div>توقيع / ختم المنشأة</div>
          <div style="margin-top:24px;border-bottom:1px dashed ${C.muted};width:150px;"></div>
        </div>
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
