import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, CheckCircle2, AlertCircle, Sparkles, UserPlus, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { executeChatCommand } from "@/lib/ai.functions";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: string;
  success?: boolean;
}

const QUICK = [
  { label: "💰 كم لي عند الكل؟", text: "كم لي عند الكل؟" },
  { label: "⚠️ من تأخر في السداد؟", text: "من تأخر في السداد؟" },
  { label: "📊 أرني ملخص الأرصدة", text: "أرني ملخص الأرصدة" },
  { label: "👤 أضف عميل جديد", text: "أضف عميل جديد اسمه" },
];

function ActionIcon({ action, success }: { action?: string; success?: boolean }) {
  if (success === false) return <AlertCircle className="size-3.5 shrink-0 mt-0.5" />;
  if (action === "add_transaction") return success ? <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" /> : null;
  if (action === "add_person") return <UserPlus className="size-3.5 shrink-0 mt-0.5" />;
  if (action === "answer") return <BarChart3 className="size-3.5 shrink-0 mt-0.5" />;
  if (success === true) return <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />;
  return null;
}

function friendlyError(msg: string) {
  if (msg.includes("quota") || msg.includes("exceeded") || msg.includes("rate")) {
    return "⚡ تجاوزت الحد المجاني للذكاء الاصطناعي. انتظر قليلاً ثم أعد المحاولة، أو أضف OPENROUTER_API_KEY في إعدادات البيئة.";
  }
  if (msg.includes("مفاتيح الذكاء") || msg.includes("API")) {
    return "🔑 مفتاح الذكاء الاصطناعي غير مضاف. أضف GEMINI_API_KEY أو OPENROUTER_API_KEY في ملف .env";
  }
  return msg;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AiChatPanel({ open, onClose }: Props) {
  const execute = useServerFn(executeChatCommand);
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "مرحباً! أنا مساعدك المحاسبي الذكي 🤖\n\nيمكنني:\n• تسجيل المعاملات — \"أعطيت محمد 500 ريال\"\n• إضافة عملاء — \"أضف عميل اسمه خالد 0501234567\"\n• استلام دفعات — \"استلمت من سامي 300 سداد\"\n• الاستفسار — \"كم لي عند أحمد؟\"\n• تحليل — \"من أكثر شخص عليه دين؟\"",
    }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 350);
  }, [open]);

  const send = async (textOverride?: string) => {
    const msg = (textOverride ?? input).trim();
    if (!msg || busy) return;
    setInput("");

    const userMsg: Message = { id: `u${Date.now()}`, role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setBusy(true);

    try {
      const res = await execute({ data: { text: msg } }) as any;
      setMessages(prev => [...prev, {
        id: `a${Date.now()}`,
        role: "assistant",
        content: res.message,
        action: res.action,
        success: res.success,
      }]);
      if (res.success && (res.action === "add_transaction" || res.action === "add_person")) {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["activePeople"] });
        queryClient.invalidateQueries({ queryKey: ["people"] });
      }
    } catch (e) {
      const err = e as { message?: string };
      setMessages(prev => [...prev, {
        id: `e${Date.now()}`,
        role: "assistant",
        content: friendlyError(err.message ?? "حدث خطأ غير متوقع"),
        success: false,
      }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative flex flex-col bg-background rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-6 duration-300"
        style={{ maxHeight: "88vh", minHeight: "50vh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b shrink-0">
          <div className="size-10 rounded-2xl bg-gradient-to-br from-violet-500 via-primary to-blue-500 flex items-center justify-center shadow-lg">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[14px] text-foreground">المساعد الذكي</div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={`size-1.5 rounded-full ${busy ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
              {busy ? "يفكر ويحلل..." : "جاهز — اكتب أمراً بالعربية"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-secondary/80 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 overscroll-contain">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="size-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-primary/20 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="size-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm font-medium"
                    : msg.success === true
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/40 rounded-bl-sm"
                    : msg.success === false
                    ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200/60 dark:border-red-700/40 rounded-bl-sm"
                    : "bg-card border border-border/50 text-foreground rounded-bl-sm"
                }`}
              >
                {(msg.success !== undefined || msg.action) && (
                  <span className="inline-flex items-center gap-1 mb-0.5 mr-0.5">
                    <ActionIcon action={msg.action} success={msg.success} />
                  </span>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {busy && (
            <div className="flex gap-2 justify-start">
              <div className="size-7 rounded-xl bg-gradient-to-br from-violet-500/20 to-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
                <Bot className="size-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "160ms" }} />
                  <span className="size-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "320ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick actions — only shown at the start */}
        {messages.length <= 1 && !busy && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {QUICK.map((q) => (
              <button
                key={q.text}
                onClick={() => send(q.text)}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-3 pb-5 pt-2 border-t shrink-0">
          <div className="flex items-end gap-2 bg-secondary/40 rounded-2xl px-3.5 py-2.5 border border-border/50 focus-within:border-primary/50 focus-within:bg-card transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب أمراً... مثال: أعطيت أحمد 500 ريال"
              rows={1}
              disabled={busy}
              dir="rtl"
              className="flex-1 bg-transparent text-[13px] resize-none outline-none placeholder:text-muted-foreground max-h-28 leading-relaxed disabled:opacity-60"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || busy}
              className="size-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" style={{ transform: "scaleX(-1)" }} />
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5 opacity-70">
            اضغط Enter للإرسال · Shift+Enter لسطر جديد
          </p>
        </div>
      </div>
    </div>
  );
}
