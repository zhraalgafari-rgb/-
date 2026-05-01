-- ============= Recurring transactions (الدوريات) =============
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('expense','transaction')),
  -- shared
  amount numeric NOT NULL,
  currency_id uuid NOT NULL,
  note text,
  -- expense-specific
  category_id uuid,
  -- transaction-specific
  person_id uuid,
  direction text CHECK (direction IS NULL OR direction IN ('credit','debit')),
  -- schedule
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  day_of_month integer,
  next_run timestamptz NOT NULL DEFAULT now(),
  last_run timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON public.recurring_rules(user_id, is_active, next_run);

-- ============= Archive support on people =============
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS avatar_color text;

-- ============= Receipt attachments on expenses =============
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_path text;

-- ============= Audit log =============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON public.audit_log(user_id, created_at DESC);

-- ============= Storage bucket for receipts =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Receipt access policies (user-foldered)
DROP POLICY IF EXISTS "receipts read own" ON storage.objects;
DROP POLICY IF EXISTS "receipts insert own" ON storage.objects;
DROP POLICY IF EXISTS "receipts update own" ON storage.objects;
DROP POLICY IF EXISTS "receipts delete own" ON storage.objects;

CREATE POLICY "receipts read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "receipts insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "receipts update own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "receipts delete own" ON storage.objects FOR DELETE
  USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);