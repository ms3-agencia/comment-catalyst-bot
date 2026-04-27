ALTER TABLE public.video_editor_drafts
  ADD CONSTRAINT video_editor_drafts_user_content_unique
  UNIQUE (user_id, content_id);