
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS credit_limit numeric;
CREATE INDEX IF NOT EXISTS idx_tx_due_date ON public.transactions(user_id, due_date) WHERE due_date IS NOT NULL AND is_paid = false;
CREATE INDEX IF NOT EXISTS idx_people_user ON public.people(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_tx_person ON public.transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
