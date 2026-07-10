import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PersonRow { id: string; name: string; phone: string | null }
interface TxRow { person_id?: string; amount: number; direction: string; transaction_date: string; details: string | null; currency_id: string }
interface ExpRow { amount: number; expense_date: string; note: string | null; category_id: string; currency_id: string }
interface CurRow { id: string; name: string; symbol: string; rate: number; is_base?: boolean }
interface CatRow { id: string; name: string }
interface OpeningRow { currency_id: string; amount: number; direction: string; note?: string | null; balance_date?: string | null }
interface CompanyRow {
  name: string | null; address: string | null; phone: string | null;
  email: string | null; tax_number: string | null; notes?: string | null;
}

export async function exportAllToExcel(userId: string, fileName = `daftarak-${Date.now()}.xlsx`) {
  const [{ data: people }, { data: txs }, { data: expenses }, { data: currencies }, { data: cats }] = await Promise.all([
    supabase.from("people").select("id,name,phone").eq("user_id", userId),
    supabase.from("transactions").select("person_id,amount,direction,transaction_date,details,currency_id").eq("user_id", userId),
    supabase.from("expenses").select("amount,expense_date,note,category_id,currency_id").eq("user_id", userId),
    supabase.from("currencies").select("id,name,symbol,rate").eq("user_id", userId),
    supabase.from("expense_categories").select("id,name").eq("user_id", userId),
  ]);
  const pMap = new Map<string, PersonRow>(((people as PersonRow[]) ?? []).map((p) => [p.id, p]));
  const cMap = new Map<string, CurRow>(((currencies as CurRow[]) ?? []).map((c) => [c.id, c]));
  const catMap = new Map<string, CatRow>(((cats as CatRow[]) ?? []).map((c) => [c.id, c]));

  const peopleSheet = ((people as PersonRow[]) ?? []).map((p) => {
    let bal = 0;
    for (const t of ((txs as TxRow[]) ?? []).filter((x) => x.person_id === p.id)) {
      const r = cMap.get(t.currency_id)?.rate ?? 1;
      bal += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * r;
    }
    return { "الاسم": p.name, "الجوال": p.phone ?? "", "الرصيد": Math.abs(bal), "الحالة": bal >= 0 ? "له" : "عليه" };
  });

  const txSheet = ((txs as TxRow[]) ?? []).map((t) => ({
    "التاريخ": new Date(t.transaction_date).toLocaleDateString("ar-EG"),
    "الاسم": pMap.get(t.person_id ?? "")?.name ?? "—",
    "النوع": t.direction === "credit" ? "له" : "عليه",
    "المبلغ": Number(t.amount),
    "العملة": cMap.get(t.currency_id)?.name ?? "",
    "التفاصيل": t.details ?? "",
  }));

  const expSheet = ((expenses as unknown as ExpRow[]) ?? []).map((e) => ({
    "التاريخ": new Date(e.expense_date).toLocaleDateString("ar-EG"),
    "التصنيف": catMap.get(e.category_id)?.name ?? "—",
    "المبلغ": Number(e.amount),
    "العملة": cMap.get(e.currency_id)?.name ?? "",
    "الوصف": e.note ?? "",
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "الأشخاص");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "المعاملات");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSheet), "المصاريف");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}

/* ============================================================
   Professional Customer Statement (Arabic, styled, per-currency)
   ============================================================ */

const COL_HEAD_BG = "FF0B3D91";       // Deep professional blue
const COL_HEAD_TXT = "FFFFFFFF";
const COL_SUBHEAD_BG = "FF1E40AF";
const COL_SECTION_BG = "FFE0E7FF";
const COL_INFO_BG = "FFF1F5F9";
const COL_ZEBRA = "FFF8FAFC";
const COL_TOTAL_BG = "FFFEF3C7";
const COL_CREDIT = "FF047857";
const COL_DEBIT = "FFB91C1C";
const COL_BORDER = "FF94A3B8";
const COL_BORDER_STRONG = "FF0B3D91";

const thinBorder = {
  top:    { style: "thin" as const, color: { argb: COL_BORDER } },
  left:   { style: "thin" as const, color: { argb: COL_BORDER } },
  bottom: { style: "thin" as const, color: { argb: COL_BORDER } },
  right:  { style: "thin" as const, color: { argb: COL_BORDER } },
};

// English digits, thousands separator, 2 decimals, red negatives, dash for zero
const NUM_FMT = '#,##0.00;[Red]-#,##0.00;"-"';

// Force English (Latin) digits for dates and formatted numbers
const fmtDateEN = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB"); // dd/MM/yyyy in Latin digits
const fmtNumEN = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Build one professional workbook for a single currency's statement. */
async function buildStatementWorkbookForCurrency(opts: {
  person: PersonRow;
  currency: CurRow;
  txs: TxRow[];
  opening: number;
  company: CompanyRow | null;
}): Promise<ArrayBuffer> {
  const { person: p, currency: cur, txs: list, opening, company: comp } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = comp?.name ?? "دفترك";
  wb.created = new Date();

  const ws = wb.addWorksheet(`كشف ${cur.name}`, {
    views: [{ rightToLeft: true, showGridLines: false, state: "normal" }],
    pageSetup: {
      paperSize: 9, orientation: "portrait",
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  ws.columns = [
    { width: 6 },   // A #
    { width: 14 },  // B Date
    { width: 42 },  // C Details
    { width: 16 },  // D Debit
    { width: 16 },  // E Credit
    { width: 18 },  // F Balance
  ];

  /* ============ COMPANY HEADER (main brand block) ============ */
  // Row 1: Company name — big, bold, centered
  ws.mergeCells("A1:F1");
  const h1 = ws.getCell("A1");
  h1.value = comp?.name || "اسم المنشأة";
  h1.font = { name: "Arial", size: 22, bold: true, color: { argb: "FFFFFFFF" } };
  h1.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  h1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_HEAD_BG } };
  ws.getRow(1).height = 42;

  // Row 2: Address
  ws.mergeCells("A2:F2");
  const h2 = ws.getCell("A2");
  h2.value = comp?.address ? `العنوان: ${comp.address}` : " ";
  h2.font = { name: "Arial", size: 11, color: { argb: "FFFFFFFF" } };
  h2.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_SUBHEAD_BG } };
  ws.getRow(2).height = 20;

  // Row 3: Phone • Email • Tax No
  ws.mergeCells("A3:F3");
  const h3 = ws.getCell("A3");
  const contactParts: string[] = [];
  if (comp?.phone) contactParts.push(`هاتف: ${comp.phone}`);
  if (comp?.email) contactParts.push(`البريد: ${comp.email}`);
  if (comp?.tax_number) contactParts.push(`الرقم الضريبي: ${comp.tax_number}`);
  h3.value = contactParts.length ? contactParts.join("   |   ") : " ";
  h3.font = { name: "Arial", size: 10, color: { argb: "FFE0E7FF" } };
  h3.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  h3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_SUBHEAD_BG } };
  ws.getRow(3).height = 18;

  // Row 4: Statement title band
  ws.mergeCells("A4:F4");
  const h4 = ws.getCell("A4");
  h4.value = `كشف حساب عميل — بعملة ${cur.name}`;
  h4.font = { name: "Arial", size: 14, bold: true, color: { argb: COL_HEAD_BG } };
  h4.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  h4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_SECTION_BG } };
  h4.border = { bottom: { style: "medium", color: { argb: COL_BORDER_STRONG } } };
  ws.getRow(4).height = 28;

  /* ============ CUSTOMER INFO BLOCK ============ */
  const infoRows: [string, string | number, string, string | number][] = [
    ["اسم العميل:", p.name || "—", "رقم الجوال:", p.phone ?? "—"],
    ["تاريخ الكشف:", fmtDateEN(new Date()), "عدد الحركات:", list.length],
  ];

  let r = 5;
  for (const [l1, v1, l2, v2] of infoRows) {
    ws.getCell(`A${r}`).value = l1;
    ws.mergeCells(`B${r}:C${r}`);
    ws.getCell(`B${r}`).value = v1;
    ws.getCell(`D${r}`).value = l2;
    ws.mergeCells(`E${r}:F${r}`);
    ws.getCell(`E${r}`).value = v2;

    for (const ref of [`A${r}`, `D${r}`]) {
      const c = ws.getCell(ref);
      c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF1F2937" } };
      c.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_INFO_BG } };
      c.border = thinBorder;
    }
    for (const ref of [`B${r}`, `E${r}`]) {
      const c = ws.getCell(ref);
      c.font = { name: "Arial", size: 11, color: { argb: "FF111827" } };
      c.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
      c.border = thinBorder;
    }
    ws.getRow(r).height = 22;
    r++;
  }

  /* ============ TABLE ============ */
  let row = r + 1;
  const headers = ["#", "التاريخ", "البيان", "مدين (عليه)", "دائن (له)", `الرصيد (${cur.symbol || cur.name})`];
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_HEAD_TXT } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_HEAD_BG } };
    c.border = thinBorder;
  });
  ws.getRow(row).height = 30;
  row++;

  // Opening balance
  let balance = opening;
  let totalDebit = opening < 0 ? Math.abs(opening) : 0;
  let totalCredit = opening > 0 ? opening : 0;

  if (opening !== 0) {
    const openCells: (string | number | null)[] = [
      0, "—", "رصيد افتتاحي",
      opening < 0 ? Math.abs(opening) : null,
      opening > 0 ? opening : null,
      balance,
    ];
    openCells.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = thinBorder;
      c.alignment = { horizontal: i === 2 ? "right" : "center", vertical: "middle", readingOrder: "rtl" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
      c.font = { name: "Arial", size: 10, italic: true, bold: true, color: { argb: "FF9A3412" } };
      if (i >= 3) c.numFmt = NUM_FMT;
    });
    ws.getRow(row).height = 20;
    row++;
  }

  // Rows
  const sorted = list.slice().sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  sorted.forEach((t, idx) => {
    const amt = Number(t.amount);
    const credit = t.direction === "credit";
    if (credit) { balance += amt; totalCredit += amt; } else { balance -= amt; totalDebit += amt; }

    const cells: (string | number | null)[] = [
      idx + 1,
      fmtDateEN(t.transaction_date),
      t.details ?? "—",
      credit ? null : amt,
      credit ? amt : null,
      balance,
    ];
    const zebra = idx % 2 === 1;
    cells.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = thinBorder;
      c.alignment = { horizontal: i === 2 ? "right" : "center", vertical: "middle", readingOrder: "rtl", wrapText: i === 2 };
      c.font = { name: "Arial", size: 10, color: { argb: "FF111827" } };
      if (zebra) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_ZEBRA } };
      if (i >= 3) c.numFmt = NUM_FMT;
      if (i === 3 && v != null) c.font = { name: "Arial", size: 10, bold: true, color: { argb: COL_DEBIT } };
      if (i === 4 && v != null) c.font = { name: "Arial", size: 10, bold: true, color: { argb: COL_CREDIT } };
      if (i === 5) c.font = { name: "Arial", size: 10, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
    });
    ws.getRow(row).height = 20;
    row++;
  });

  // Totals
  const totalCells: (string | number | null)[] = ["", "", "الإجمالي", totalDebit, totalCredit, balance];
  totalCells.forEach((v, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = v;
    c.border = { ...thinBorder, top: { style: "double" as const, color: { argb: COL_HEAD_BG } } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_TOTAL_BG } };
    c.alignment = { horizontal: i === 2 ? "right" : "center", vertical: "middle", readingOrder: "rtl" };
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF111827" } };
    if (i >= 3) c.numFmt = NUM_FMT;
    if (i === 3) c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_DEBIT } };
    if (i === 4) c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_CREDIT } };
    if (i === 5) c.font = { name: "Arial", size: 12, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
  });
  ws.getRow(row).height = 26;
  row++;

  // Final balance
  ws.mergeCells(`A${row}:F${row}`);
  const fb = ws.getCell(`A${row}`);
  const status = balance >= 0 ? "له" : "عليه";
  fb.value = `الرصيد النهائي بعملة ${cur.name}: ${fmtNumEN(Math.abs(balance))} ${cur.symbol ?? ""} (${status})`;
  fb.font = { name: "Arial", size: 13, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
  fb.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  fb.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_INFO_BG } };
  fb.border = thinBorder;
  ws.getRow(row).height = 28;
  row += 2;

  // Notes (from company profile)
  if (comp?.notes) {
    ws.mergeCells(`A${row}:F${row}`);
    const nt = ws.getCell(`A${row}`);
    nt.value = comp.notes;
    nt.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF374151" } };
    nt.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl", wrapText: true };
    ws.getRow(row).height = 22;
    row++;
  }

  // Footer
  ws.mergeCells(`A${row}:F${row}`);
  const ft = ws.getCell(`A${row}`);
  ft.value = `${comp?.name ? comp.name + "  •  " : ""}تم الإنشاء بواسطة دفترك  •  ${fmtDateEN(new Date())}`;
  ft.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };
  ft.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  ws.getRow(row).height = 18;

  return await wb.xlsx.writeBuffer() as ArrayBuffer;
}


/**
 * Export professional Excel statements for a customer.
 * Produces ONE polished workbook per currency the customer transacted in
 * (or has an opening balance in). E.g. SAR + YER → two files.
 */
export async function exportPersonToExcel(personId: string, personName: string) {
  const [{ data: person }, { data: txs }, { data: currencies }, { data: company }, { data: openings }] = await Promise.all([
    supabase.from("people").select("id,name,phone").eq("id", personId).maybeSingle(),
    supabase.from("transactions").select("amount,direction,transaction_date,details,currency_id").eq("person_id", personId).order("transaction_date", { ascending: true }),
    supabase.from("currencies").select("id,name,symbol,rate,is_base"),
    supabase.from("company_profile").select("name,address,phone,email,tax_number,notes").maybeSingle(),
    supabase.from("opening_balances").select("currency_id,amount,direction").eq("person_id", personId),
  ]);

  const p: PersonRow = (person as PersonRow | null) ?? { id: personId, name: personName, phone: null };
  const cMap = new Map<string, CurRow>(((currencies as CurRow[]) ?? []).map((c) => [c.id, c]));
  const txList = (txs as TxRow[]) ?? [];
  const opList = (openings as OpeningRow[]) ?? [];
  const comp = (company as CompanyRow | null) ?? null;

  // Collect used currency ids from txs + openings
  const usedIds = new Set<string>();
  txList.forEach((t) => usedIds.add(t.currency_id));
  opList.forEach((o) => usedIds.add(o.currency_id));

  if (usedIds.size === 0) {
    // Nothing to export — build empty base-currency workbook so the user gets a valid file
    const base = (currencies as CurRow[])?.find((c) => c.is_base) ?? (currencies as CurRow[])?.[0];
    if (!base) return;
    const buf = await buildStatementWorkbookForCurrency({ person: p, currency: base, txs: [], opening: 0, company: comp });
    const safe = (p.name || personName || "عميل").replace(/[\\/:*?"<>|]/g, "_");
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `كشف-حساب-${safe}-${base.name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }

  // Order: base currency first
  const ordered = Array.from(usedIds).sort((a, b) => {
    const ab = cMap.get(a)?.is_base ? 1 : 0;
    const bb = cMap.get(b)?.is_base ? 1 : 0;
    return bb - ab;
  });

  const safe = (p.name || personName || "عميل").replace(/[\\/:*?"<>|]/g, "_");
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < ordered.length; i++) {
    const curId = ordered[i];
    const cur = cMap.get(curId);
    if (!cur) continue;
    const currencyTxs = txList.filter((t) => t.currency_id === curId);
    const openingSigned = opList
      .filter((o) => o.currency_id === curId)
      .reduce((s, o) => s + Number(o.amount) * (o.direction === "credit" ? 1 : -1), 0);
    const buf = await buildStatementWorkbookForCurrency({ person: p, currency: cur, txs: currencyTxs, opening: openingSigned, company: comp });
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `كشف-حساب-${safe}-${cur.name}-${today}.xlsx`);
    if (i < ordered.length - 1) await wait(400); // give the browser time between downloads
  }
}
