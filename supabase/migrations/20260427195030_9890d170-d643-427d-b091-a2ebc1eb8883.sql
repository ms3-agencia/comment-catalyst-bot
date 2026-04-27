ALTER TABLE public.video_render_history REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.video_render_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;