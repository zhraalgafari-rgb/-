import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  initialName: string;
  initialPhone: string | null;
  onSuccess: () => void;
}

export function EditPersonDialog({ open, onOpenChange, personId, initialName, initialPhone, onSuccess }: Props) {
  const { user } = useAuth();
  const [draftName, setDraftName] = useState(initialName);
  const [draftPhone, setDraftPhone] = useState(initialPhone ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftName(initialName);
      setDraftPhone(initialPhone ?? "");
    }
  }, [open, initialName, initialPhone]);

  const saveName = async () => {
    if (!user) return;
    if (!draftName.trim()) { toast.error("الاسم مطلوب"); return; }
    
    setBusy(true);
    try {
      const { error } = await supabase.from("people").update({ 
        name: draftName.trim(), 
        phone: draftPhone.trim() || null 
      }).eq("id", personId);
      
      if (error) throw error;
      
      const { logAudit } = await import("@/lib/audit");
      await logAudit(user.id, "update", "person", personId, { name: draftName.trim() });
      
      toast.success("تم الحفظ");
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-right">تعديل البيانات</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="الاسم" maxLength={80} />
          <Input value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="رقم الجوال (اختياري)" dir="ltr" maxLength={30} />
          <Button onClick={saveName} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
            {busy ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
