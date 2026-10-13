CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('lesson','summary')),
  domain text,
  unit text,
  page_number int NOT NULL DEFAULT 1,
  parent_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  image_path text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons readable" ON public.lessons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert own lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own lessons" ON public.lessons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete own lessons" ON public.lessons FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "public read lesson images" ON storage.objects FOR SELECT USING (bucket_id = 'lessons-images');
CREATE POLICY "upload own lesson images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lessons-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "delete own lesson images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lessons-images' AND (storage.foldername(name))[1] = auth.uid()::text);