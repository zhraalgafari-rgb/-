import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}
function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
function dmy(d: string | Date) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
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

/** Brand colors */
const C_PRIMARY: [number, number, number] = [29, 78, 216];   // deep blue
const C_PRIMARY_SOFT: [number, number, number] = [219, 234, 254];
const C_ACCENT: [number, number, number] = [16, 185, 129];   // emerald
const C_DANGER: [number, number, number] = [220, 38, 38];    // rose
const C_TEXT: [number, number, number] = [17, 24, 39];
const C_MUTED: [number, number, number] = [107, 114, 128];
const C_BORDER: [number, number, number] = [229, 231, 235];
const C_BG_ALT: [number, number, number] = [249, 250, 251];

function drawHeader(doc: jsPDF, company: CompanyInfo | null, logo: string | null) {
  const pageW = doc.internal.pageSize.getWidth();

  // Top brand band
  doc.setFillColor(...C_PRIMARY);
  doc.rect(0, 0, pageW, 28, "F");
  // accent stripe
  doc.setFillColor(...C_ACCENT);
  doc.rect(0, 28, pageW, 1.5, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Statement of Account", pageW / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("كشف حساب تفصيلي", pageW / 2, 19, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Date: ${dmy(new Date())}`, pageW - 12, 24, { align: "right" });

  // Company block
  doc.setTextColor(...C_TEXT);
  if (logo) {
    try { doc.addImage(logo, "PNG", 12, 34, 20, 20); } catch { /* ignore */ }
  }
  const x = logo ? 36 : 12;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(company?.name ?? "Daftarak  •  دفترك", x, 40);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  const meta: string[] = [];
  if (company?.phone) meta.push(`Tel: ${company.phone}`);
  if (company?.email) meta.push(company.email);
  if (company?.tax_number) meta.push(`Tax# ${company.tax_number}`);
  if (meta.length) doc.text(meta.join("   |   "), x, 45);
  if (company?.address) doc.text(company.address, x, 49);

  return 60;
}

function drawCustomerBox(doc: jsPDF, y: number, personName: string, phone?: string | null) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...C_PRIMARY_SOFT);
  doc.setDrawColor(...C_PRIMARY);
  doc.setLineWidth(0.4);
  doc.roundedRect(12, y, pageW - 24, 14, 2, 2, "FD");
  doc.setTextColor(...C_TEXT);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`Customer / العميل:`, 16, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(personName, 50, y + 6);
  if (phone) {
    doc.setFont("helvetica", "bold");
    doc.text("Phone:", 16, y + 11);
    doc.setFont("helvetica", "normal");
    doc.text(phone, 30, y + 11);
  }
  return y + 18;
}

function drawKpiRow(doc: jsPDF, y: number, kpis: { label: string; value: string; color: [number, number, number] }[]) {
  const pageW = doc.internal.pageSize.getWidth();
  const total = pageW - 24;
  const gap = 3;
  const w = (total - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((k, i) => {
    const x = 12 + i * (w + gap);
    doc.setDrawColor(...C_BORDER);
    doc.setFillColor(...C_BG_ALT);
    doc.roundedRect(x, y, w, 13, 1.5, 1.5, "FD");
    doc.setTextColor(...C_MUTED);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(k.label, x + 2.5, y + 4.5);
    doc.setTextColor(...k.color);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(k.value, x + 2.5, y + 10.5);
  });
  return y + 17;
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

  // Period filter
  const filteredTxs = txs.filter((t) => {
    const d = new Date(t.transaction_date).getTime();
    if (dateFrom && d < dateFrom.getTime()) return false;
    if (dateTo && d > dateTo.getTime()) return false;
    return true;
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = drawHeader(doc, company, logo);
  y = drawCustomerBox(doc, y, personName, phone);

  // Period label
  if (dateFrom || dateTo) {
    doc.setTextColor(...C_MUTED); doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text(`Period: ${dateFrom ? dmy(dateFrom) : "—"}  →  ${dateTo ? dmy(dateTo) : "—"}`, 12, y);
    y += 5;
  }

  // Determine currencies used
  const used = currencies.filter((c) =>
    filteredTxs.some((t) => t.currency_id === c.id) || openings.some((o) => o.currency_id === c.id),
  );
  if (used.length === 0) used.push(...currencies.slice(0, 1));
  // base first
  used.sort((a, b) => Number(b.is_base) - Number(a.is_base));

  // Overall KPI (multi-currency safe by base equivalent)
  let totalCredit = 0, totalDebit = 0;
  for (const t of filteredTxs) {
    const r = currencies.find((c) => c.id === t.currency_id)?.rate ?? 1;
    if (t.direction === "credit") totalCredit += Number(t.amount) * r;
    else totalDebit += Number(t.amount) * r;
  }
  const base = currencies.find((c) => c.is_base);
  const baseSym = base?.symbol ?? "";
  y = drawKpiRow(doc, y, [
    { label: `Total Credit (${baseSym})`, value: fmt(totalCredit), color: C_ACCENT },
    { label: `Total Debit (${baseSym})`,  value: fmt(totalDebit),  color: C_DANGER },
    { label: "Transactions",              value: fmtInt(filteredTxs.length), color: C_PRIMARY },
  ]);
  y += 2;

  // Per-currency sections
  for (const cur of used) {
    const open = openings.filter((o) => o.currency_id === cur.id)
      .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);
    const curTxs = [...filteredTxs.filter((t) => t.currency_id === cur.id)]
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    if (curTxs.length === 0 && open === 0) continue;

    // Currency header
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFillColor(...C_PRIMARY);
    doc.rect(12, y, pageW - 24, 8, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`${cur.name}  (${cur.symbol})`, 16, y + 5.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Currency Section`, pageW - 16, y + 5.6, { align: "right" });
    y += 10;

    // Per-currency KPIs
    let cCredit = 0, cDebit = 0;
    for (const t of curTxs) {
      if (t.direction === "credit") cCredit += Number(t.amount);
      else cDebit += Number(t.amount);
    }
    const closing = open + cCredit - cDebit;

    // Build rows
    let acc = open;
    const body: (string | number)[][] = [];
    let idx = 1;
    if (open !== 0) {
      body.push([
        "—", "0", "Opening Balance",
        open > 0 ? fmt(Math.abs(open)) : "—",
        open < 0 ? fmt(Math.abs(open)) : "—",
        fmt(open), "",
      ]);
    }
    for (const t of curTxs) {
      const signed = Number(t.amount) * (t.direction === "credit" ? 1 : -1);
      acc += signed;
      body.push([
        dmy(t.transaction_date),
        String(idx++),
        t.details ?? (t.direction === "credit" ? "Credit" : "Debit"),
        t.direction === "credit" ? fmt(Number(t.amount)) : "—",
        t.direction === "debit"  ? fmt(Number(t.amount)) : "—",
        fmt(acc),
        "",
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["Date", "#", "Description", "Credit (له)", "Debit (عليه)", `Balance (${cur.symbol})`, "Ref"]],
      body,
      styles: { fontSize: 8, cellPadding: 1.6, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.1 },
      headStyles: { fillColor: C_PRIMARY, textColor: 255, halign: "center", fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: C_BG_ALT },
      columnStyles: {
        0: { halign: "center", cellWidth: 22 },
        1: { halign: "center", cellWidth: 8 },
        2: { halign: "left",   cellWidth: "auto" },
        3: { halign: "right",  cellWidth: 26, textColor: C_ACCENT, fontStyle: "bold" },
        4: { halign: "right",  cellWidth: 26, textColor: C_DANGER, fontStyle: "bold" },
        5: { halign: "right",  cellWidth: 28, fontStyle: "bold" },
        6: { halign: "center", cellWidth: 14 },
      },
      margin: { left: 12, right: 12 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Closing balance band
    const status = closing > 0 ? "Owed to you  /  له عندك"
                   : closing < 0 ? "You owe  /  عليك"
                   : "Settled  /  مسددة";
    const color = closing >= 0 ? C_ACCENT : C_DANGER;
    doc.setFillColor(...color);
    doc.roundedRect(12, finalY + 2, pageW - 24, 9, 1.5, 1.5, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(`Closing Balance:  ${fmt(Math.abs(closing))} ${cur.symbol}`, 16, finalY + 8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(status, pageW - 16, finalY + 8, { align: "right" });
    doc.setTextColor(...C_TEXT);
    y = finalY + 15;
  }

  // Notes
  if (company?.notes) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setTextColor(...C_MUTED); doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text("Notes / ملاحظات:", 12, y); y += 4;
    const lines = doc.splitTextToSize(company.notes, pageW - 24);
    doc.text(lines, 12, y);
  }

  // Footer for all pages
  const pageCount = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C_BORDER); doc.setLineWidth(0.2);
    doc.line(12, 285, pageW - 12, 285);
    doc.setTextColor(...C_MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("Generated by Daftarak  •  دفترك", 12, 290);
    doc.text(`Page ${p} / ${pageCount}`, pageW - 12, 290, { align: "right" });
  }

  doc.save(`statement-${personName}-${Date.now()}.pdf`);
}
