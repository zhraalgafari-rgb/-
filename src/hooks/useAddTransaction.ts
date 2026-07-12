import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evalExpr } from "@/lib/calc";

export interface EditingTx {
  id: string;
  person_id: string;
  account_id?: string | null;
  amount: number;
  direction: string;
  currency_id: string;
  details: string | null;
  transaction_date: string;
  due_date?: string | null;
}

export interface Prefill {
  newName?: string;
  amount?: number;
  direction?: "credit" | "debit";
  details?: string;
}

export function useAddTransaction({
  open,
  user,
  editing,
  prefill,
  currencies,
  accounts,
  people,
  defaultPersonId,
  onSuccess,
  onOpenChange,
}: any) {
  const [personId, setPersonId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPersonId(editing.person_id);
      setNewName("");
      setAmount(String(editing.amount));
      setDetails(editing.details ?? "");
      setDirection(editing.direction as "credit" | "debit");
      setCurrencyId(editing.currency_id);
      setAccountId(editing.account_id ?? "");
      setDate(new Date(editing.transaction_date).toISOString().slice(0, 16));
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : "");
    } else {
      const base = currencies.find((c: any) => c.is_base) ?? currencies[0];
      if (prefill) {
        const matched = prefill.newName ? people.find((p: any) => p.name.trim() === prefill.newName!.trim()) : undefined;
        setPersonId(matched?.id ?? defaultPersonId ?? "");
        setNewName(matched ? "" : prefill.newName ?? "");
        setAmount(prefill.amount != null ? String(prefill.amount) : "");
        setDetails(prefill.details ?? "");
        setDirection(prefill.direction ?? "credit");
      } else {
        setPersonId(defaultPersonId ?? "");
        setNewName("");
        setAmount(""); setDetails("");
        setDirection("credit");
      }
      setCurrencyId(base?.id ?? "");
      setAccountId(accounts?.find((a: any) => a.is_default)?.id ?? accounts?.[0]?.id ?? "");
      setDate(new Date().toISOString().slice(0, 16));
      setDueDate("");
    }
    setPendingFile(null);
  }, [open, defaultPersonId, currencies, editing, prefill, people]);

  const submit = async () => {
    if (!user) return;
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (!currencyId) { toast.error("اختر العملة"); return; }
    let pid = personId;
    setBusy(true);
    try {
      if (!pid && !editing) {
        const name = newName.trim();
        if (!name) { toast.error("اختر شخصاً أو أدخل اسماً جديداً"); setBusy(false); return; }
        const { data, error } = await supabase.from("people").insert({ name, user_id: user.id }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      const selectedCur = currencies.find((c: any) => c.id === currencyId);
      const rateAtTx = selectedCur?.rate ?? 1;
      const payload = {
        user_id: user.id,
        person_id: pid,
        currency_id: currencyId,
        account_id: accountId || null,
        amount: amt,
        direction,
        details: details.trim() || null,
        transaction_date: new Date(date).toISOString(),
        due_date: dueDate || null,
        rate_at_tx: rateAtTx,
      };
      const { data: txData, error: te } = editing
        ? await supabase.from("transactions").update(payload).eq("id", editing.id).select("id").single()
        : await supabase.from("transactions").insert(payload).select("id").single();
      if (te) throw te;
      const newTxId = (txData as { id: string } | null)?.id ?? editing?.id;
      
      // Upload pending attachment if any
      if (pendingFile && newTxId) {
        try {
          if (pendingFile.size > 5 * 1024 * 1024) {
            toast.error("المرفق تجاوز 5MB ولم يُرفع");
          } else {
            const ext = pendingFile.name.split(".").pop() || "bin";
            const path = `${user.id}/transaction/${newTxId}/${Date.now()}.${ext}`;
            const { error: ue } = await supabase.storage.from("receipts").upload(path, pendingFile);
            if (ue) throw ue;
            await supabase.from("attachments").insert({
              user_id: user.id, entity_type: "transaction", entity_id: newTxId,
              storage_path: path, file_name: pendingFile.name, mime_type: pendingFile.type, size_bytes: pendingFile.size,
            } as never);
          }
        } catch (err) {
          const e = err as { message?: string };
          toast.error("فشل رفع المرفق: " + (e.message ?? ""));
        }
      }
      const { logAudit } = await import("@/lib/audit");
      await logAudit(user.id, editing ? "update" : "create", "transaction", newTxId, { amount: payload.amount, direction: payload.direction });
      toast.success(editing ? "تم التعديل" : "تمت الإضافة");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  return {
    personId, setPersonId,
    newName, setNewName,
    amount, setAmount,
    details, setDetails,
    direction, setDirection,
    currencyId, setCurrencyId,
    accountId, setAccountId,
    date, setDate,
    dueDate, setDueDate,
    busy,
    pendingFile, setPendingFile,
    submit
  };
}
