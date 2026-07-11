import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function getModel() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    // gemini-1.5-flash-8b is the free-tier model available in Google AI Studio
    return google("gemini-1.5-flash-8b");
  }
  
  if (openRouterKey) {
    const openRouter = createOpenAICompatible({
      name: "openrouter",
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    // Append :free to use the free tier on OpenRouter
    return openRouter("google/gemini-2.0-flash-exp:free");
  }

  throw new Error("تأكد من إضافة مفاتيح الذكاء الاصطناعي (Gemini أو OpenRouter)");
}

/** Parse free-form Arabic text into a structured transaction draft. */
export const parseDebtText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const model = getModel();
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          person_name: z.string().describe("اسم الشخص فقط"),
          amount: z.number().describe("المبلغ كرقم"),
          direction: z.enum(["credit", "debit"]).describe("credit = له عندي / أعطيته، debit = عليه / استلمت منه"),
          details: z.string().describe("وصف قصير"),
        }),
      }),
      system: "أنت مساعد محاسبي. حلل النص العربي العامي/الفصيح واستخرج بيانات المعاملة. credit يعني أن المستخدم أعطى مال للشخص (له عند الشخص). debit يعني أن المستخدم استلم مال من الشخص (عليه للشخص). إن كان غامضاً فاختر credit.",
      prompt: data.text,
    });
    return output;
  });

/** Generate a polite WhatsApp-ready reminder message. */
export const generateReminderMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      person_name: z.string().min(1).max(80),
      amount: z.number(),
      currency: z.string().max(20).optional(),
      days_overdue: z.number().int().optional(),
      tone: z.enum(["polite", "firm", "friendly"]).default("polite"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const model = getModel();
    const toneAr = data.tone === "firm" ? "حازمة ومحترمة" : data.tone === "friendly" ? "ودية وغير رسمية" : "مهذبة ورسمية";
    const { text } = await generateText({
      model,
      system: `أنت كاتب رسائل عربية احترافية. اكتب رسالة واتساب ${toneAr} لتذكير شخص بدفع مبلغ مستحق. قواعد: 3-5 أسطر، بدون رموز كثيرة، بدون توقيع، ابدأ بالسلام أو تحية مناسبة. استخدم اللهجة الفصحى السهلة.`,
      prompt: `الاسم: ${data.person_name}\nالمبلغ: ${data.amount} ${data.currency ?? ""}\n${data.days_overdue ? `تأخر ${data.days_overdue} يوم` : ""}`,
    });
    return { message: text.trim() };
  });

/** Full AI chat command: understands intent, fetches DB context, executes the operation. */
export const executeChatCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const model = getModel();

    // Fetch context: people + balances + currencies
    const [{ data: people }, { data: currencies }] = await Promise.all([
      supabase.from("people").select("id,name,phone").eq("is_archived", false).eq("user_id", userId),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
    ]);
    const baseCurrency = (currencies ?? [])[0];

    const { data: balRows } = await (supabase.from("view_dashboard_person_balances") as any).select("person_id,net,tx_count");
    const balMap = new Map<string, number>();
    for (const row of balRows ?? []) balMap.set(row.person_id, Number(row.net));

    const peopleList = (people ?? []) as { id: string; name: string; phone: string | null }[];
    const peopleContext = peopleList.map(p => {
      const net = balMap.get(p.id) ?? 0;
      const balLabel = net > 0 ? `له ${net}` : net < 0 ? `عليه ${Math.abs(net)}` : "مسوى";
      return `${p.name}[${p.id}](رصيد:${balLabel})`;
    }).join(" | ");

    const ActionSchema = z.object({
      action: z.enum(["add_transaction", "add_person", "answer", "unclear"]),
      // transaction
      person_id: z.string().optional(),
      person_name: z.string().optional(),
      amount: z.number().optional(),
      direction: z.enum(["credit", "debit"]).optional(),
      details: z.string().optional(),
      // new person
      new_name: z.string().optional(),
      new_phone: z.string().optional(),
      new_type: z.enum(["customer", "supplier", "employee", "other"]).optional(),
      // response
      message: z.string(),
    });

    const { output } = await generateText({
      model,
      output: Output.object({ schema: ActionSchema }),
      system: `أنت مساعد محاسبي خبير وذكي لتطبيق دفترك.نقود مختصرة:
- credit = المستخدم أعطى مالاً / دفع / سلف (الشخص مدين للمستخدم)
- debit = المستخدم استلم مالاً / دفع له الشخص (سداد)
- "أعطيت/سلفت/دفعت/قرضت" → credit
- "استلمت/دفع/سدد/أرجع" → debit
عملاء الحساب: ${peopleContext || "لا يوجد عملاء بعد"}
العملة الافتراضية: ${baseCurrency?.name ?? "ريال سعودي"}
لاستفسارات الأرصدة والتحليل، أجب مباشرة من بيانات العملاء. رسالتك يجب أن تكون عربية واضحة ومختصرة.`,
      prompt: data.text,
    });

    // Execute server-side
    if (output.action === "add_transaction") {
      const pid = output.person_id;
      const matched = peopleList.find(p => p.id === pid);
      if (!matched) {
        return { success: false, action: "add_transaction", message: `لم أتعرف على "ه${output.person_name ?? ""}" في قائمة عملائك. هل تريد إضافته كعميل جديد؟` };
      }
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        person_id: matched.id,
        currency_id: baseCurrency?.id ?? null,
        amount: output.amount,
        direction: output.direction,
        details: output.details ?? null,
        transaction_date: new Date().toISOString(),
        rate_at_tx: baseCurrency?.rate ?? 1,
      } as never);
      if (error) return { success: false, action: "add_transaction", message: `خطأ في الحفظ: ${error.message}` };
      return { success: true, action: "add_transaction", message: output.message };
    }

    if (output.action === "add_person") {
      const COLORS = ["#3b82f6","#10b981","#f97316","#ec4899","#8b5cf6"];
      const { error } = await supabase.from("people").insert({
        user_id: userId,
        name: output.new_name ?? output.person_name ?? "",
        phone: output.new_phone ?? null,
        type: output.new_type ?? "customer",
        avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)],
      } as never);
      if (error) return { success: false, action: "add_person", message: `خطأ في الإضافة: ${error.message}` };
      return { success: true, action: "add_person", message: output.message };
    }

    return { success: true, action: output.action, message: output.message };
  });

