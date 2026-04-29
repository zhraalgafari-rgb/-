-- Categories for expenses
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Tag',
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.expense_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID,
  currency_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);

-- Monthly budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID,
  currency_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  period TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period)
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reminders for debts
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  person_id UUID,
  title TEXT NOT NULL,
  note TEXT,
  due_date TIMESTAMPTZ NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_reminders_user_due ON public.reminders(user_id, due_date);

-- Profile (display name, pin lock, preferences)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  pin_hash TEXT,
  theme TEXT NOT NULL DEFAULT 'light',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Update timestamp trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default expense categories on signup (extend existing seed function)
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.expense_categories (user_id, name, icon, color, is_default, sort_order) VALUES
    (NEW.id, 'طعام وشراب', 'UtensilsCrossed', '#f97316', true, 1),
    (NEW.id, 'مواصلات', 'Car', '#3b82f6', true, 2),
    (NEW.id, 'فواتير', 'Receipt', '#8b5cf6', true, 3),
    (NEW.id, 'تسوق', 'ShoppingBag', '#ec4899', true, 4),
    (NEW.id, 'صحة', 'HeartPulse', '#ef4444', true, 5),
    (NEW.id, 'ترفيه', 'Gamepad2', '#10b981', true, 6),
    (NEW.id, 'تعليم', 'GraduationCap', '#06b6d4', true, 7),
    (NEW.id, 'منزل', 'Home', '#a16207', true, 8),
    (NEW.id, 'أخرى', 'MoreHorizontal', '#64748b', true, 99);

  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- Combine triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_currencies ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;

CREATE TRIGGER on_auth_user_created_currencies
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.seed_default_currencies();

CREATE TRIGGER on_auth_user_created_categories
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- Backfill for existing users
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.profiles);

INSERT INTO public.expense_categories (user_id, name, icon, color, is_default, sort_order)
SELECT u.id, c.name, c.icon, c.color, true, c.sort_order
FROM auth.users u
CROSS JOIN (VALUES
  ('طعام وشراب','UtensilsCrossed','#f97316',1),
  ('مواصلات','Car','#3b82f6',2),
  ('فواتير','Receipt','#8b5cf6',3),
  ('تسوق','ShoppingBag','#ec4899',4),
  ('صحة','HeartPulse','#ef4444',5),
  ('ترفيه','Gamepad2','#10b981',6),
  ('تعليم','GraduationCap','#06b6d4',7),
  ('منزل','Home','#a16207',8),
  ('أخرى','MoreHorizontal','#64748b',99)
) AS c(name, icon, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories ec WHERE ec.user_id = u.id);