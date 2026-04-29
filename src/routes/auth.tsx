import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const handle = async (mode: "in" | "up") => {
    if (!email || password.length < 6) {
      toast.error("أدخل بريداً صحيحاً وكلمة مرور لا تقل عن 6 أحرف");
      return;
    }
    setBusy(true);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else if (mode === "up") toast.success("تم إنشاء الحساب! يمكنك تسجيل الدخول الآن.");
    else navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 text-white/90 hover:text-white mb-6 text-sm">
          <ArrowLeft className="size-4 rotate-180" /> العودة للرئيسية
        </Link>

        <div className="text-center mb-6">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur mb-3 shadow-glow">
            <Wallet className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">مرحباً بك في دفترك</h1>
          <p className="text-white/80 text-sm mt-1">إدارة ديونك ومصاريفك بكل احترافية</p>
        </div>

        <Card className="p-6 shadow-elevated">
          <Tabs defaultValue="in" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="in">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="up">إنشاء حساب</TabsTrigger>
            </TabsList>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">كلمة المرور</Label>
                <Input id="pw" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <TabsContent value="in" className="mt-4">
              <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow" disabled={busy} onClick={() => handle("in")}>
                {busy ? "..." : "تسجيل الدخول"}
              </Button>
            </TabsContent>
            <TabsContent value="up" className="mt-4">
              <Button className="w-full bg-gradient-primary text-primary-foreground shadow-glow" disabled={busy} onClick={() => handle("up")}>
                {busy ? "..." : "إنشاء حساب جديد"}
              </Button>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
