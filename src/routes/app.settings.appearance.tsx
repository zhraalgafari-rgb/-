import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/common/PageHeader";
import { Palette, Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/app/settings/appearance")({ component: AppearancePage });

const ACCENTS = [
  { id: "blue", name: "أزرق", color: "oklch(0.55 0.18 245)" },
  { id: "green", name: "أخضر", color: "oklch(0.6 0.17 165)" },
  { id: "violet", name: "بنفسجي", color: "oklch(0.55 0.2 295)" },
  { id: "rose", name: "وردي", color: "oklch(0.6 0.2 15)" },
  { id: "amber", name: "كهرماني", color: "oklch(0.7 0.16 75)" },
];

const SIZES = [
  { id: "sm", label: "صغير", scale: "0.95" },
  { id: "md", label: "عادي", scale: "1" },
  { id: "lg", label: "كبير", scale: "1.075" },
];

function AppearancePage() {
  const { theme, set } = useTheme();
  const [accent, setAccent] = useState("blue");
  const [size, setSize] = useState("md");

  useEffect(() => {
    try {
      const a = localStorage.getItem("daftarak.accent") ?? "blue";
      const s = localStorage.getItem("daftarak.fontsize") ?? "md";
      setAccent(a); setSize(s);
      applyAccent(a); applySize(s);
    } catch {}
  }, []);

  const applyAccent = (id: string) => {
    const c = ACCENTS.find((x) => x.id === id);
    if (c) document.documentElement.style.setProperty("--primary", c.color);
  };
  const applySize = (id: string) => {
    const s = SIZES.find((x) => x.id === id);
    if (s) document.documentElement.style.fontSize = `${parseFloat(s.scale) * 16}px`;
  };

  const pickAccent = (id: string) => {
    setAccent(id); applyAccent(id);
    try { localStorage.setItem("daftarak.accent", id); } catch {}
  };
  const pickSize = (id: string) => {
    setSize(id); applySize(id);
    try { localStorage.setItem("daftarak.fontsize", id); } catch {}
  };

  return (
    <div className="space-y-2.5">
      <PageHeader icon={Palette} title="المظهر" subtitle="خصّص ألوان وحجم خط التطبيق" back="/app/settings" />

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">السمة</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "light", label: "فاتح", icon: Sun },
            { id: "dark", label: "داكن", icon: Moon },
            { id: "system", label: "تلقائي", icon: Monitor },
          ].map((t) => {
            const Icon = t.icon;
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => set(t.id as "light" | "dark" | "system")}
                className={`flex flex-col items-center gap-1 py-1.5 rounded-md border transition-all ${active ? "border-primary bg-primary/5" : "border-input bg-card"}`}
              >
                <Icon className="size-4" />
                <span className="text-[11px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">اللون الأساسي</Label>
        <div className="flex flex-wrap gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => pickAccent(a.id)}
              style={{ background: a.color }}
              className={`size-7 rounded-md transition-all ${accent === a.id ? "ring-2 ring-primary ring-offset-2 scale-110" : ""}`}
              aria-label={a.name}
              title={a.name}
            />
          ))}
        </div>
      </Card>

      <Card className="p-2.5 space-y-2">
        <Label className="text-[11px]">حجم الخط</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSize(s.id)}
              className={`py-1.5 rounded-md font-semibold transition-all ${size === s.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}
              style={{ fontSize: `${parseFloat(s.scale) * 0.85}rem` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
