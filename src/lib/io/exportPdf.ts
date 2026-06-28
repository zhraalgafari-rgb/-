import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
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

function drawHeader(doc: jsPDF, company: CompanyInfo | null, logo: string | null, title: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Brand band
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Statement of Account", pageW / 2, 18, { align: "center" });
  doc.setTextColor(0, 0, 0);

  let y = 30;
  if (logo) {
    try { doc.addImage(logo, "PNG", 15, 26, 18, 18); } catch { /* ignore */ }
  }
  if (company?.name) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(company.name, logo ? 36 : 15, 32);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const meta: string[] = [];
  if (company?.phone) meta.push(`Tel: ${company.phone}`);
  if (company?.email) meta.push(company.email);
  if (company?.tax_number) meta.push(`Tax# ${company.tax_number}`);
  if (meta.length) doc.text(meta.join("  |  "), logo ? 36 : 15, 37);
  if (company?.address) doc.text(company.address, logo ? 36 : 15, 41);
  y = Math.max(y, logo ? 48 : (company?.address ? 45 : 38));
  return y;
}

export async function exportPersonStatementPDF(opts: {
  personName: string;
  phone?: string | null;
  txs: Tx[];
  currencies: Currency[];
  openings?: OpeningBalance[];
  balance: number; // legacy unused (kept for backwards-compat)
}) {
  const { personName, phone, txs, currencies, openings = [] } = opts;
  const company = await fetchCompany();
  const logo = company?.logo_path ? await logoDataUrl(company.logo_path) : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = drawHeader(doc, company, logo, "Daftarak  •  دفترك");

  // Customer
  doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(`Customer / العميل: ${personName}`, 15, y);
  if (phone) doc.text(`Phone: ${phone}`, 15, y + 5);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 195, y, { align: "right" });
  y += phone ? 10 : 6;

  // Per-currency separation
  const used = currencies.filter((c) =>
    txs.some((t) => t.currency_id === c.id) || openings.some((o) => o.currency_id === c.id),
  );
  if (used.length === 0) used.push(...currencies.slice(0, 1));

  for (const cur of used) {
    const open = openings.filter((o) => o.currency_id === cur.id)
      .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);
    let acc = open;
    const rows = [...txs.filter((t) => t.currency_id === cur.id)]
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
      .map((t) => {
        const signed = Number(t.amount) * (t.direction === "credit" ? 1 : -1);
        acc += signed;
        return [
          new Date(t.transaction_date).toLocaleDateString("en-GB"),
          t.direction === "credit" ? "Credit (له)" : "Debit (عليه)",
          fmt(Number(t.amount)),
          fmt(acc),
          t.details ?? "",
        ];
      });

    if (rows.length === 0 && open === 0) continue;

    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`Currency: ${cur.name} (${cur.symbol})`, 15, y + 4);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: y + 6,
      head: [["Date", "Type", "Amount", "Running", "Details"]],
      body: [
        ...(open !== 0 ? [["—", "Opening", fmt(Math.abs(open)) + (open >= 0 ? " (Cr)" : " (Dr)"), fmt(open), "Opening balance"]] : []),
        ...rows,
      ],
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, halign: "center" },
      columnStyles: { 4: { halign: "right", cellWidth: 60 } },
      margin: { left: 15, right: 15 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    const status = acc >= 0 ? "Owed to you (له)" : "You owe (عليه)";
    doc.setFillColor(acc >= 0 ? 16 : 220, acc >= 0 ? 185 : 38, acc >= 0 ? 129 : 38);
    doc.setTextColor(255);
    doc.rect(15, finalY + 3, 180, 8, "F");
    doc.text(`${cur.name} Balance: ${fmt(Math.abs(acc))} ${cur.symbol}  —  ${status}`, 105, finalY + 8.5, { align: "center" });
    doc.setTextColor(0);
    y = finalY + 16;

    if (y > 250) { doc.addPage(); y = 20; }
  }

  // Notes & footer
  if (company?.notes) {
    doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text(company.notes, 15, 280);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Generated by Daftarak • دفترك", 105, 290, { align: "center" });

  doc.save(`statement-${personName}-${Date.now()}.pdf`);
}
