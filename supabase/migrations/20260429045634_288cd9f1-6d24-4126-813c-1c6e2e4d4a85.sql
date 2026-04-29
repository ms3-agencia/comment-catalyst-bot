ALTER TABLE public.generated_contents
ADD COLUMN IF NOT EXISTS slides jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.generated_contents.slides IS
'Sequential narrative slides for carousel content. Each item: { index:int, text:string, visual:string, image_url?:string, image_prompt?:string }';