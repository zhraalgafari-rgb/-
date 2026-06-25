import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

interface PersonRow { id: string; name: string; phone: string | null }
interface TxRow { person_id: string; amount: number; direction: string; transaction_date: string; details: string | null; currency_id: string }
interface ExpRow { amount: number; expense_date: string; description: string | null; category_id: string; currency_id: string }
interface CurRow { id: string; name: string; symbol: string; rate: number }
interface CatRow { id: string; name: string }

export async function exportAllToExcel(userId: string, fileName = `daftarak-${Date.now()}.xlsx`) {
  const [{ data: people }, { data: txs }, { data: expenses }, { data: currencies }, { data: cats }] = await Promise.all([
    supabase.from("people").select("id,name,phone").eq("user_id", userId),
    supabase.from("transactions").select("person_id,amount,direction,transaction_date,details,currency_id").eq("user_id", userId),
    supabase.from("expenses").select("amount,expense_date,description,category_id,currency_id").eq("user_id", userId),
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

  const expSheet = ((expenses as ExpRow[]) ?? []).map((e) => ({
    "التاريخ": new Date(e.expense_date).toLocaleDateString("ar-EG"),
    "التصنيف": catMap.get(e.category_id)?.name ?? "—",
    "المبلغ": Number(e.amount),
    "العملة": cMap.get(e.currency_id)?.name ?? "",
    "الوصف": e.description ?? "",
  }));

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "الأشخاص");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txSheet), "المعاملات");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expSheet), "المصاريف");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}

export async function exportPersonToExcel(personId: string, personName: string) {
  const [{ data: txs }, { data: currencies }] = await Promise.all([
    supabase.from("transactions").select("amount,direction,transaction_date,details,currency_id").eq("person_id", personId),
    supabase.from("currencies").select("id,name,rate"),
  ]);
  const cMap = new Map<string, CurRow>(((currencies as CurRow[]) ?? []).map((c) => [c.id, c]));
  const rows = ((txs as TxRow[]) ?? []).map((t) => ({
    "التاريخ": new Date(t.transaction_date).toLocaleDateString("ar-EG"),
    "النوع": t.direction === "credit" ? "له" : "عليه",
    "المبلغ": Number(t.amount),
    "العملة": cMap.get(t.currency_id)?.name ?? "",
    "التفاصيل": t.details ?? "",
  }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), personName.slice(0, 28));
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${personName}-${Date.now()}.xlsx`);
}
