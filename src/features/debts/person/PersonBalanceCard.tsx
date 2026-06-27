import { fmtMoney } from "@/lib/format";

interface Props { name: string; phone: string | null; balance: number; txCount: number }

export function PersonBalanceCard({ name, phone, balance, txCount }: Props) {
  const isCredit = balance >= 0;
  return (
    <div className={`rounded-xl p-3 shadow-elevated text-white ${isCredit ? "bg-gradient-success" : "bg-gradient-danger"}`}>
      <div className="text-[11px] opacity-90 mb-0.5">
        {name}
        {phone && <span className="ms-2 opacity-75" dir="ltr">{phone}</span>}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] opacity-90">{isCredit ? "له عندك" : "عليه"}</div>
          <div className="text-2xl font-black mt-0.5 tabular-nums leading-tight">{fmtMoney(Math.abs(balance))}</div>
        </div>
        <div className="text-[10px] opacity-90">{txCount} معاملة</div>
      </div>
    </div>
  );
}
