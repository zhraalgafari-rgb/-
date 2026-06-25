import { uploadBackup } from "./upload";

const FREQ_KEY = "daftarak.backup.lastAuto";
export async function maybeRunAutoBackup(userId: string, frequency: "off" | "daily" | "weekly" | "monthly") {
  if (frequency === "off") return;
  const last = Number(localStorage.getItem(FREQ_KEY) ?? 0);
  const ms = Date.now() - last;
  const day = 24 * 60 * 60 * 1000;
  const need = frequency === "daily" ? day : frequency === "weekly" ? 7 * day : 30 * day;
  if (ms < need) return;
  const r = await uploadBackup(userId, "auto");
  if (r) localStorage.setItem(FREQ_KEY, String(Date.now()));
}
