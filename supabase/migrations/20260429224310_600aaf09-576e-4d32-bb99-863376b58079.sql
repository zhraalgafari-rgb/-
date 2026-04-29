
-- Currencies table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  rate NUMERIC NOT NULL DEFAULT 1,
  is_base BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- People (clients/suppliers)
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  details TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_user ON public.people(user_id);
CREATE INDEX idx_tx_user ON public.transactions(user_id);
CREATE INDEX idx_tx_person ON public.transactions(person_id);
CREATE INDEX idx_currencies_user ON public.currencies(user_id);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies: each user owns their data
CREATE POLICY "own currencies" ON public.currencies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own people" ON public.people FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger: seed default currencies for new users
CREATE OR REPLACE FUNCTION public.seed_default_currencies()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.currencies (user_id, name, symbol, rate, is_base) VALUES
    (NEW.id, 'محلي', '', 1, true),
    (NEW.id, 'دولار', '$', 1, false),
    (NEW.id, 'سعودي', 'ر.س', 1, false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_currencies
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_currencies();
