import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Person { id: string; name: string }
interface Currency { id: string; name: string; is_base: boolean }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  people: Person[];
  currencies: Currency[];
  onSuccess: () => void;
  defaultPersonId?: string;
}

export function AddTransactionDialog({ open, onOpenChange, people, currencies, onSuccess, defaultPersonId }: Props) {
  const { user } = useAuth();
  const [personId, setPersonId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPersonId(defaultPersonId ?? "");
      setNewName("");
      setAmount("");
      setDetails("");
      setDirection("credit");
      const base = currencies.find((c) => c.is_base) ?? currencies[0];
      setCurrencyId(base?.id ?? "");
    }
  }, [open, defaultPersonId, currencies]);

  const submit = async () => {
    if (!user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    if (!currencyId) { toast.error("اختر العملة"); return; }
    let pid = personId;
    setBusy(true);
    try {
      if (!pid) {
        const name = newName.trim();
        if (!name) { toast.error("اختر شخصاً أو أدخل اسماً جديداً"); setBusy(false); return; }
        const { data, error } = await supabase.from("people").insert({ name, user_id: user.id }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      const { error: te } = await supabase.from("transactions").insert({
        user_id: user.id,
        person_id: pid,
        currency_id: currencyId,
        amount: amt,
        direction,
        details: details.trim() || null,
      });
      if (te) throw te;
      toast.success("تمت الإضافة");
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const selectedPerson = people.find((p) => p.id === personId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة معاملة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>الشخص</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedPerson ? selectedPerson.name : (newName || "اختر أو أضف اسماً جديداً")}
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث أو اكتب اسماً جديداً..." value={newName} onValueChange={(v) => { setNewName(v); setPersonId(""); }} />
                  <CommandList>
                    <CommandEmpty>
                      <div className="text-sm">سيُنشأ شخص جديد باسم "{newName}"</div>
                    </CommandEmpty>
                    <CommandGroup>
                      {people.map((p) => (
                        <CommandItem key={p.id} value={p.name} onSelect={() => { setPersonId(p.id); setNewName(""); setPickerOpen(false); }}>
                          <Check className={`size-4 ${personId === p.id ? "opacity-100" : "opacity-0"}`} />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>المبلغ</Label>
              <Input type="number" inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>العملة</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>التفاصيل (اختياري)</Label>
            <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="مثلاً: ماء ديتر وكاله" />
          </div>

          <RadioGroup value={direction} onValueChange={(v) => setDirection(v as any)} className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "credit" ? "border-success bg-success-soft text-success" : "border-border"}`}>
              <RadioGroupItem value="credit" className="sr-only" />
              <TrendingUp className="size-4" /> له (دائن)
            </label>
            <label className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 cursor-pointer transition-all ${direction === "debit" ? "border-danger bg-danger-soft text-danger" : "border-border"}`}>
              <RadioGroupItem value="debit" className="sr-only" />
              <TrendingDown className="size-4" /> عليه (مدين)
            </label>
          </RadioGroup>

          <Button onClick={submit} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "..." : "حفظ المعاملة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
