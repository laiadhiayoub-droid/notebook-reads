CREATE TABLE public.banned_users (
  email text PRIMARY KEY,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banned_users TO authenticated;
GRANT ALL ON public.banned_users TO service_role;
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage bans" ON public.banned_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.current_user_banned() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_users b
    WHERE lower(b.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
GRANT EXECUTE ON FUNCTION public.current_user_banned() TO authenticated;

-- banned users lose all data access, enforced in the database
CREATE POLICY "banned blocked lessons" ON public.lessons AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.current_user_banned()) WITH CHECK (NOT public.current_user_banned());
CREATE POLICY "banned blocked profiles" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.current_user_banned()) WITH CHECK (NOT public.current_user_banned());
CREATE POLICY "banned blocked storage" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.current_user_banned()) WITH CHECK (NOT public.current_user_banned());

-- admins can moderate any lesson
CREATE POLICY "admins update any lesson" ON public.lessons FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete any lesson" ON public.lessons FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete any lesson image" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lessons-images' AND public.has_role(auth.uid(), 'admin'));

-- lesson reads for analytics
CREATE TABLE public.lesson_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lesson_views TO authenticated;
GRANT ALL ON public.lesson_views TO service_role;
ALTER TABLE public.lesson_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log own views" ON public.lesson_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.current_user_banned());
CREATE POLICY "admins read views" ON public.lesson_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- announcement banner (single row)
CREATE TABLE public.site_announcement (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_announcement TO anon, authenticated;
GRANT UPDATE ON public.site_announcement TO authenticated;
GRANT ALL ON public.site_announcement TO service_role;
ALTER TABLE public.site_announcement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active announcement" ON public.site_announcement FOR SELECT TO anon, authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins edit announcement" ON public.site_announcement FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.site_announcement (id, message, active) VALUES (1, '', false);

-- admin RPCs
CREATE OR REPLACE FUNCTION public.admin_list_users_full()
RETURNS TABLE(id uuid, email text, full_name text, roles app_role[], banned boolean, lessons_count bigint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name,
    coalesce((SELECT array_agg(r.role) FROM public.user_roles r WHERE r.user_id = u.id), '{}'),
    EXISTS (SELECT 1 FROM public.banned_users b WHERE lower(b.email) = lower(u.email)),
    (SELECT count(*) FROM public.lessons l WHERE l.user_id = u.id),
    u.created_at
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_users_full() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users_full() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_name(_user_id uuid, _name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(_name)) < 2 THEN RAISE EXCEPTION 'name too short'; END IF;
  INSERT INTO public.profiles (id, full_name) VALUES (_user_id, trim(_name))
  ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_name(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_name(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ban(_email text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
             WHERE lower(u.email) = lower(trim(_email)) AND r.role = 'admin') THEN
    RAISE EXCEPTION 'cannot ban an admin';
  END IF;
  INSERT INTO public.banned_users (email, banned_by) VALUES (lower(trim(_email)), auth.uid())
  ON CONFLICT (email) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.admin_ban(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE(students bigint, lessons bigint, banned bigint, top_subjects jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT
    (SELECT count(*) FROM auth.users),
    (SELECT count(*) FROM public.lessons),
    (SELECT count(*) FROM public.banned_users),
    coalesce((SELECT jsonb_agg(jsonb_build_object('subject', s.subject, 'views', s.c) ORDER BY s.c DESC)
      FROM (SELECT v.subject, count(*) c FROM public.lesson_views v GROUP BY v.subject ORDER BY c DESC LIMIT 5) s), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;