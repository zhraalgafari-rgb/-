import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

interface PersonRow { id: string; name: string; phone: string | null }
interface TxRow { person_id: string; amount: number; direction: string; transaction_date: string; details: string | null; currency_id: string }
interface ExpRow { amount: number; expense_date: string; note: string | null; category_id: string; currency_id: string }
interface CurRow { id: string; name: string; symbol: string; rate: number }
interface CatRow { id: string; name: string }

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
    "الاسم": pMap.get(t.person_id)?.name ?? "—",
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
   Professional Customer Statement (Arabic, styled, multi-currency)
   ============================================================ */

const COL_HEAD_BG = "FF1E40AF";       // deep blue
const COL_HEAD_TXT = "FFFFFFFF";
const COL_SECTION_BG = "FFDBEAFE";    // light blue
const COL_ZEBRA = "FFF8FAFC";
const COL_TOTAL_BG = "FFFEF3C7";      // amber
const COL_CREDIT = "FF047857";        // green
const COL_DEBIT = "FFB91C1C";         // red
const COL_BORDER = "FF94A3B8";

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COL_BORDER } },
  left: { style: "thin" as const, color: { argb: COL_BORDER } },
  bottom: { style: "thin" as const, color: { argb: COL_BORDER } },
  right: { style: "thin" as const, color: { argb: COL_BORDER } },
};

const ARABIC_NUM_FMT = '#,##0.00;[Red]-#,##0.00;"—"';

export async function exportPersonToExcel(personId: string, personName: string) {
  const [{ data: person }, { data: txs }, { data: currencies }, { data: company }, { data: userRes }] = await Promise.all([
    supabase.from("people").select("id,name,phone").eq("id", personId).maybeSingle(),
    supabase.from("transactions").select("amount,direction,transaction_date,details,currency_id").eq("person_id", personId).order("transaction_date", { ascending: true }),
    supabase.from("currencies").select("id,name,symbol,rate,is_base"),
    supabase.from("company_profile").select("name,address,phone,email,tax_number").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  void userRes;

  const p = (person as { id: string; name: string; phone: string | null } | null) ?? { id: personId, name: personName, phone: null };
  const cMap = new Map<string, CurRow & { is_base?: boolean }>(((currencies as Array<CurRow & { is_base: boolean }>) ?? []).map((c) => [c.id, c]));
  const txList = ((txs as TxRow[]) ?? []);

  const wb = new ExcelJS.Workbook();
  wb.creator = (company as { name?: string } | null)?.name ?? "دفترك";
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 16000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const ws = wb.addWorksheet("كشف حساب", {
    views: [{ rightToLeft: true, showGridLines: false, state: "normal" }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  // Column widths (6 cols: #, date, details, debit, credit, balance)
  ws.columns = [
    { width: 6 },   // A #
    { width: 14 },  // B Date
    { width: 38 },  // C Details
    { width: 16 },  // D Debit (عليه)
    { width: 16 },  // E Credit (له)
    { width: 18 },  // F Balance
  ];

  // ============ HEADER ============
  const comp = (company as { name: string | null; address: string | null; phone: string | null; email: string | null; tax_number: string | null } | null);

  // Row 1: Company name
  ws.mergeCells("A1:F1");
  const c1 = ws.getCell("A1");
  c1.value = comp?.name || "كشف حساب عميل";
  c1.font = { name: "Arial", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  c1.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_HEAD_BG } };
  ws.getRow(1).height = 36;

  // Row 2: Company contact line
  ws.mergeCells("A2:F2");
  const c2 = ws.getCell("A2");
  const compLine = [comp?.address, comp?.phone && `📞 ${comp.phone}`, comp?.email, comp?.tax_number && `الرقم الضريبي: ${comp.tax_number}`].filter(Boolean).join("  •  ");
  c2.value = compLine || " ";
  c2.font = { name: "Arial", size: 10, color: { argb: "FFE0E7FF" } };
  c2.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  ws.getRow(2).height = 20;

  // Row 3: Statement title bar
  ws.mergeCells("A3:F3");
  const c3 = ws.getCell("A3");
  c3.value = "كشف حساب عميل";
  c3.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E40AF" } };
  c3.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_SECTION_BG } };
  ws.getRow(3).height = 26;

  // Row 4-5: Customer info box
  ws.getCell("A4").value = "اسم العميل:"; ws.getCell("B4").value = p.name;
  ws.getCell("D4").value = "رقم الجوال:"; ws.getCell("E4").value = p.phone ?? "—";
  ws.getCell("A5").value = "تاريخ الكشف:"; ws.getCell("B5").value = new Date().toLocaleDateString("ar-EG");
  ws.getCell("D5").value = "عدد المعاملات:"; ws.getCell("E5").value = txList.length;

  for (const ref of ["A4", "D4", "A5", "D5"]) {
    const c = ws.getCell(ref);
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF374151" } };
    c.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    c.border = thinBorder;
  }
  for (const ref of ["B4", "E4", "B5", "E5"]) {
    const c = ws.getCell(ref);
    c.font = { name: "Arial", size: 11, color: { argb: "FF111827" } };
    c.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
    c.border = thinBorder;
  }
  ws.mergeCells("B4:C4"); ws.mergeCells("E4:F4");
  ws.mergeCells("B5:C5"); ws.mergeCells("E5:F5");
  ws.getRow(4).height = 22; ws.getRow(5).height = 22;

  // Group transactions by currency
  const byCurrency = new Map<string, TxRow[]>();
  for (const t of txList) {
    const arr = byCurrency.get(t.currency_id) ?? [];
    arr.push(t); byCurrency.set(t.currency_id, arr);
  }
  // Order: base currency first
  const orderedCurIds = Array.from(byCurrency.keys()).sort((a, b) => {
    const ab = cMap.get(a)?.is_base ? 1 : 0;
    const bb = cMap.get(b)?.is_base ? 1 : 0;
    return bb - ab;
  });

  let row = 7;

  if (orderedCurIds.length === 0) {
    ws.mergeCells(`A${row}:F${row}`);
    const e = ws.getCell(`A${row}`);
    e.value = "لا توجد معاملات لهذا العميل";
    e.font = { name: "Arial", size: 12, italic: true, color: { argb: "FF6B7280" } };
    e.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    e.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_ZEBRA } };
    ws.getRow(row).height = 30;
    row += 2;
  }

  for (const curId of orderedCurIds) {
    const cur = cMap.get(curId);
    const curName = cur?.name ?? "—";
    const list = (byCurrency.get(curId) ?? []).slice().sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

    // Currency section header
    ws.mergeCells(`A${row}:F${row}`);
    const sh = ws.getCell(`A${row}`);
    sh.value = `معاملات بعملة: ${curName}`;
    sh.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1E3A8A" } };
    sh.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl", indent: 1 };
    sh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_SECTION_BG } };
    sh.border = thinBorder;
    ws.getRow(row).height = 24;
    row++;

    // Table header
    const headers = ["#", "التاريخ", "البيان", "مدين (عليه)", "دائن (له)", `الرصيد (${curName})`];
    headers.forEach((h, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = h;
      c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_HEAD_TXT } };
      c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_HEAD_BG } };
      c.border = thinBorder;
    });
    ws.getRow(row).height = 28;
    row++;

    // Data rows
    let balance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    list.forEach((t, idx) => {
      const amt = Number(t.amount);
      const credit = t.direction === "credit";
      if (credit) { balance += amt; totalCredit += amt; } else { balance -= amt; totalDebit += amt; }

      const cells = [
        idx + 1,
        new Date(t.transaction_date).toLocaleDateString("ar-EG"),
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
        if (i === 3 || i === 4 || i === 5) c.numFmt = ARABIC_NUM_FMT;
        if (i === 3 && v != null) c.font = { name: "Arial", size: 10, bold: true, color: { argb: COL_DEBIT } };
        if (i === 4 && v != null) c.font = { name: "Arial", size: 10, bold: true, color: { argb: COL_CREDIT } };
        if (i === 5) c.font = { name: "Arial", size: 10, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
      });
      ws.getRow(row).height = 20;
      row++;
    });

    // Totals row
    const totalCells: (string | number | null)[] = ["", "", "الإجمالي", totalDebit, totalCredit, balance];
    totalCells.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      c.border = { ...thinBorder, top: { style: "double" as const, color: { argb: COL_HEAD_BG } } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_TOTAL_BG } };
      c.alignment = { horizontal: i === 2 ? "right" : "center", vertical: "middle", readingOrder: "rtl" };
      c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF111827" } };
      if (i === 3 || i === 4 || i === 5) c.numFmt = ARABIC_NUM_FMT;
      if (i === 3) c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_DEBIT } };
      if (i === 4) c.font = { name: "Arial", size: 11, bold: true, color: { argb: COL_CREDIT } };
      if (i === 5) c.font = { name: "Arial", size: 12, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
    });
    ws.getRow(row).height = 26;
    row++;

    // Final balance summary
    ws.mergeCells(`A${row}:F${row}`);
    const fb = ws.getCell(`A${row}`);
    const status = balance >= 0 ? "له" : "عليه";
    fb.value = `الرصيد النهائي بعملة ${curName}: ${Math.abs(balance).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${status})`;
    fb.font = { name: "Arial", size: 12, bold: true, color: { argb: balance >= 0 ? COL_CREDIT : COL_DEBIT } };
    fb.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    fb.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    fb.border = thinBorder;
    ws.getRow(row).height = 24;
    row += 2; // gap
  }

  // Footer
  ws.mergeCells(`A${row}:F${row}`);
  const ft = ws.getCell(`A${row}`);
  ft.value = `تم الإنشاء بواسطة دفترك  •  ${new Date().toLocaleString("ar-EG")}`;
  ft.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };
  ft.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  ws.getRow(row).height = 18;

  const buf = await wb.xlsx.writeBuffer();
  const safeName = (p.name || personName || "عميل").replace(/[\\/:*?"<>|]/g, "_");
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `كشف-حساب-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
