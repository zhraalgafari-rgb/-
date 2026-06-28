
-- Phase 1: Multi-currency infrastructure

-- 1. Exchange rates table
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  rate_to_base NUMERIC NOT NULL CHECK (rate_to_base > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exchange rates" ON public.exchange_rates FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX idx_exchange_rates_lookup ON public.exchange_rates(user_id, currency_id, effective_date DESC);

-- 2. Opening balances per person × currency
CREATE TABLE public.opening_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'credit' CHECK (direction IN ('credit','debit')),
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(person_id, currency_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_balances TO authenticated;
GRANT ALL ON public.opening_balances TO service_role;
ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own opening balances" ON public.opening_balances FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER tg_opening_balances_updated BEFORE UPDATE ON public.opening_balances FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_opening_balances_person ON public.opening_balances(user_id, person_id);

-- 3. Company profile (for statements/invoices)
CREATE TABLE public.company_profile (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_path TEXT,
  tax_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_profile TO authenticated;
GRANT ALL ON public.company_profile TO service_role;
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company profile" ON public.company_profile FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER tg_company_profile_updated BEFORE UPDATE ON public.company_profile FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Customer ratings (AI-generated)
CREATE TABLE public.customer_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('excellent','very_good','good','average','high_risk')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  reason TEXT,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ratings TO authenticated;
GRANT ALL ON public.customer_ratings TO service_role;
ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customer ratings" ON public.customer_ratings FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- 5. Attachments (generalized — supports any transaction/expense)
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction','expense','person')),
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.attachments FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX idx_attachments_entity ON public.attachments(user_id, entity_type, entity_id);

-- 6. Snapshot of rate at transaction time (for historical accuracy)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS rate_at_tx NUMERIC;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS rate_at_tx NUMERIC;

-- Backfill rate_at_tx from current currencies.rate (best available)
UPDATE public.transactions t
SET rate_at_tx = c.rate
FROM public.currencies c
WHERE t.currency_id = c.id AND t.rate_at_tx IS NULL;

UPDATE public.expenses e
SET rate_at_tx = c.rate
FROM public.currencies c
WHERE e.currency_id = c.id AND e.rate_at_tx IS NULL;

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_transactions_person_currency_date
  ON public.transactions(user_id, person_id, currency_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_currency_date
  ON public.expenses(user_id, currency_id, expense_date DESC);

-- 8. Update default seed: SAR as base, YER secondary, USD optional
CREATE OR REPLACE FUNCTION public.seed_default_currencies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.currencies (user_id, name, symbol, rate, is_base) VALUES
    (NEW.id, 'ريال سعودي', 'ر.س', 1, true),
    (NEW.id, 'ريال يمني', 'ر.ي', 0.0024, false),
    (NEW.id, 'دولار',     '$',   3.75, false);
  RETURN NEW;
END;
$function$;
