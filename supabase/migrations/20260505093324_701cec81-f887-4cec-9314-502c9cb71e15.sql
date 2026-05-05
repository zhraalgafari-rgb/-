
-- Backups bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users access only their own folder (named with user id)
CREATE POLICY "own backups read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own backups insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own backups delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Backup metadata
CREATE TABLE public.backup_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own backup_meta"
  ON public.backup_meta FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX backup_meta_user_idx ON public.backup_meta(user_id, created_at DESC);

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS notif_subscription jsonb,
  ADD COLUMN IF NOT EXISTS backup_frequency text NOT NULL DEFAULT 'off'; -- 'off' | 'daily' | 'weekly' | 'monthly'
