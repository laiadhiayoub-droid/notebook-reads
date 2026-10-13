DROP POLICY "profiles readable" ON public.profiles;
CREATE POLICY "profiles readable by signed in" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon;
DROP POLICY "lessons readable" ON public.lessons;
CREATE POLICY "lessons readable by signed in" ON public.lessons FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.lessons FROM anon;
DROP POLICY "public read lesson images" ON storage.objects;
CREATE POLICY "signed in read lesson images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lessons-images' AND auth.uid() IS NOT NULL);