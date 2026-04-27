REVOKE EXECUTE ON FUNCTION public.cleanup_video_editor_drafts() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_run_draft_cleanup() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_run_draft_cleanup() TO authenticated;