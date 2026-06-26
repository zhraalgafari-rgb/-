
ALTER TABLE public.reminders 
  ADD COLUMN IF NOT EXISTS repeat text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON public.reminders(user_id, is_done, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_txn ON public.reminders(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reminder_per_txn ON public.reminders(transaction_id) WHERE transaction_id IS NOT NULL;
