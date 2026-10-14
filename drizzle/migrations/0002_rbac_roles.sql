CREATE TYPE public.app_role AS ENUM ('admin', 'writer', 'student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  IF lower(NEW.email) = 'laiadhiayoub@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- backfill existing users
INSERT INTO public.user_roles (user_id, role) SELECT id, 'student' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'laiadhiayoub@gmail.com' ON CONFLICT DO NOTHING;

-- admin helpers
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (id uuid, email text, full_name text, roles public.app_role[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, p.full_name,
      COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}')
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_roles r ON r.user_id = u.id
    GROUP BY u.id, u.email, p.full_name
    ORDER BY p.full_name NULLS LAST;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_writer(_user_id uuid, _is_writer boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _is_writer THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'writer') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'writer';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_writer(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_writer(uuid, boolean) TO authenticated;

-- restrict uploads
DROP POLICY "insert own lessons" ON public.lessons;
CREATE POLICY "writers insert own lessons" ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(), 'writer') OR public.has_role(auth.uid(), 'admin')));
DROP POLICY "upload own lesson images" ON storage.objects;
CREATE POLICY "writers upload own lesson images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lessons-images' AND (storage.foldername(name))[1] = auth.uid()::text
    AND (public.has_role(auth.uid(), 'writer') OR public.has_role(auth.uid(), 'admin')));