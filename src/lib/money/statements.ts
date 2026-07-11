import { PerCurrencyBalance } from "@/lib/money/balances";
import { fmtDate } from "@/lib/format";

interface ShareCompany {
  name: string | null;
  phone: string | null;
  address: string | null;
}

interface StatementData {
  personName: string;
  company: ShareCompany | null;
  txsCount: number;
  balancesByCurrency: any[]; // Using any to match the existing generic balance output or PerCurrencyBalance[]
}

export function buildShareText({ personName, company, txsCount, balancesByCurrency }: StatementData): string {
  const companyName = company?.name?.trim() || "دفترك";
  const today = new Date().toLocaleDateString("ar-EG");
  const lines: string[] = [];
  
  lines.push("✨ *السلام عليكم ورحمة الله وبركاته* ✨");
  lines.push(`الأستاذ/ة: *${personName}* المحترم،`);
  lines.push("تحية طيبة وبعد..");
  lines.push("");
  lines.push(`📑 نرفق لكم ملخص كشف الحساب من *${companyName}*`);
  lines.push(`📅 حتى تاريخ: ${today}`);
  lines.push("");
  lines.push("📊 *الرصيد الإجمالي:*");
  lines.push("────────────────");
  
  const nonZero = balancesByCurrency.filter((b) => Math.abs(b.balance) > 0.009 || b.txCount > 0);
  if (nonZero.length === 0) {
    lines.push("✅ الحساب مصفر (لا توجد حركات مالية مسجلة حالياً).");
  } else {
    for (const b of nonZero) {
      const tag = b.balance > 0 ? "🟢 لكم (دائن)" : b.balance < 0 ? "🔴 عليكم (مدين)" : "⚪ مسدد بالكامل";
      const amt = Math.abs(b.balance).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      lines.push(`▪️ ${b.currency.name}: *${amt} ${b.currency.symbol}*  ${tag}`);
    }
  }
  
  lines.push("────────────────");
  lines.push(`📝 عدد المعاملات المسجلة: ${txsCount}`);
  lines.push("");
  lines.push("يرجى مراجعة التفاصيل وإعلامنا في حال وجود أي استفسار أو ملاحظة. نحن دائماً في خدمتكم.");
  lines.push("");
  lines.push("مع خالص التحيات،");
  lines.push(`🏢 *${companyName}*`);
  if (company?.phone) lines.push(`📞 هاتف: ${company.phone}`);
  if (company?.address) lines.push(`📍 العنوان: ${company.address}`);
  
  return lines.join("\n");
}
