ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_type_check;
ALTER TABLE public.people ADD CONSTRAINT people_type_check CHECK (type IN ('person', 'company', 'general', 'customer', 'supplier', 'employee', 'other'));
