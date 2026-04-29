-- Phone column already exists; ensure index for lookups
CREATE INDEX IF NOT EXISTS idx_people_user ON public.people(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_person ON public.transactions(person_id);