import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evalExpr } from "@/lib/calc";

export interface EditingExpense {
  id: string;
  amount: number;
  category_id: string | null;
  account_id?: string | null;
  currency_id: string;
  note: string | null;
  expense_date: string;
  receipt_path?: string | null;
}

export function useExpenseForm({
  open,
  user,
  editing,
  currencies,
  categories,
  accounts,
  onSuccess,
  onOpenChange,
}: any) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setAmount(String(editing.amount));
      setCategoryId(editing.category_id ?? "");
      setAccountId(editing.account_id ?? "");
      setCurrencyId(editing.currency_id);
      setNote(editing.note ?? "");
      setDate(new Date(editing.expense_date).toISOString().slice(0, 16));
      setReceiptPath(editing.receipt_path ?? null);
    } else {
      setAmount(""); setNote("");
      setCategoryId(categories[0]?.id ?? "");
      setAccountId(accounts?.find((a: any) => a.is_default)?.id ?? accounts?.[0]?.id ?? "");
      const base = currencies.find((c: any) => c.is_base) ?? currencies[0];
      setCurrencyId(base?.id ?? "");
      setDate(new Date().toISOString().slice(0, 16));
      setReceiptPath(null);
    }
    setReceiptUrl(null);
  }, [open, editing, categories, currencies]);

  // Resolve signed URL for preview
  useEffect(() => {
    if (!receiptPath) { setReceiptUrl(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from("receipts").createSignedUrl(receiptPath, 600);
      if (!cancelled) setReceiptUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [receiptPath]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5 ميجا");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, { upsert: false, contentType: file.type });
    setUploading(false);
    if (error) return toast.error(error.message);
    // Remove old
    if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]).catch(() => undefined);
    setReceiptPath(path);
  };

  const removeReceipt = async () => {
    if (receiptPath) await supabase.storage.from("receipts").remove([receiptPath]).catch(() => undefined);
    setReceiptPath(null);
  };

  const submit = async () => {
    if (!user) return;
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    if (!currencyId) return toast.error("اختر العملة");
    setBusy(true);
    const payload = {
      user_id: user.id,
      amount: amt,
      category_id: categoryId || null,
      account_id: accountId || null,
      currency_id: currencyId,
      note: note.trim() || null,
      expense_date: new Date(date).toISOString(),
      receipt_path: receiptPath,
    };
    const op = editing
      ? supabase.from("expenses").update(payload).eq("id", editing.id)
      : supabase.from("expenses").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) return toast.error(error.message);
    const { logAudit } = await import("@/lib/audit");
    await logAudit(user.id, editing ? "update" : "create", "expense", editing?.id, { amount: payload.amount });
    toast.success(editing ? "تم التعديل" : "تمت الإضافة");
    onSuccess(); onOpenChange(false);
  };

  return {
    amount, setAmount,
    categoryId, setCategoryId,
    accountId, setAccountId,
    currencyId, setCurrencyId,
    note, setNote,
    date, setDate,
    receiptPath,
    receiptUrl,
    uploading,
    busy,
    handleUpload,
    removeReceipt,
    submit
  };
}
