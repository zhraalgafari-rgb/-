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
    return google("gemini-2.5-flash");
  }
  
  if (openRouterKey) {
    const openRouter = createOpenAICompatible({
      name: "openrouter",
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    return openRouter("google/gemini-2.5-flash");
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
