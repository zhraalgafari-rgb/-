import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AmountInput } from "@/components/AmountInput";
import { evalExpr } from "@/lib/calc";
import { fmtMoney } from "@/lib/format";

interface Account { id: string; name: string; currency_id: string; is_default: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; allocations?: { allocated_amount: number }[] }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  debtTx: Tx | null;
  accounts: Account[];
  onSuccess: () => void;
}

export function PaymentDialog({ open, onOpenChange, debtTx, accounts, onSuccess }: Props) {
  const { user } = useAuth();
  
  const totalAllocated = debtTx?.allocations?.reduce((s, a) => s + Number(a.allocated_amount), 0) ?? 0;
  const remaining = (debtTx?.amount ?? 0) - totalAllocated;

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && debtTx) {
      setAmount(String(remaining > 0 ? remaining : ""));
      setAccountId(accounts.find(a => a.is_default)?.id ?? accounts[0]?.id ?? "");
      setDate(new Date().toISOString().slice(0, 16));
      setDetails("");
    }
  }, [open, debtTx, remaining, accounts]);

  const submit = async () => {
    if (!user || !debtTx) return;
    const amt = evalExpr(amount);
    if (!isFinite(amt) || amt <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (amt > remaining) { toast.error(`المبلغ يتجاوز المتبقي (${remaining})`); return; }
    if (!accountId) { toast.error("اختر المحفظة/الحساب"); return; }

    setBusy(true);
    try {
      // 1. Create Counter Transaction
      const { data: newTx, error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        person_id: debtTx.person_id,
        account_id: accountId,
        currency_id: debtTx.currency_id,
        amount: amt,
        direction: debtTx.direction === "credit" ? "debit" : "credit",
        transaction_date: new Date(date).toISOString(),
        details: `دفعة سداد: ${details.trim() || "بدون ملاحظات"}`,
      }).select("id").single();
      
      if (txErr) throw txErr;

      // 2. Create Allocation
      const { error: allocErr } = await supabase.from("payment_allocations").insert({
        user_id: user.id,
        debt_tx_id: debtTx.id,
        payment_tx_id: newTx.id,
        allocated_amount: amt,
      });

      if (allocErr) throw allocErr;

      toast.success("تم تسجيل الدفعة بنجاح");
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ أثناء الدفع");
    } finally {
      setBusy(false);
    }
  };

  if (!debtTx) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">تسجيل سداد / دفعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border">
            <div>
              <div className="text-xs text-muted-foreground">قيمة الفاتورة/الدين</div>
              <div className="font-bold tabular-nums">{fmtMoney(debtTx.amount)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">المتبقي للسداد</div>
              <div className="font-bold tabular-nums text-primary">{fmtMoney(remaining)}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>مبلغ الدفعة</Label>
            <AmountInput value={amount} onChange={setAmount} />
            <div className="text-[11px] text-muted-foreground flex gap-2">
              <button onClick={() => setAmount(String(remaining))} className="text-primary hover:underline">المتبقي كاملاً</button>
              <button onClick={() => setAmount(String(remaining / 2))} className="text-primary hover:underline">نصف المتبقي</button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>المحفظة / الحساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المحفظة" />
              </SelectTrigger>
              <SelectContent>
                {accounts.length === 0 ? (
                  <SelectItem value="none" disabled>لا توجد محافظ</SelectItem>
                ) : (
                  accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="size-3.5 text-muted-foreground" />
                        {a.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>تاريخ السداد</Label>
            <Input type="datetime-local" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>

          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "جاري التسجيل..." : "تأكيد الدفعة"} <CheckCircle2 className="size-4 ms-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
