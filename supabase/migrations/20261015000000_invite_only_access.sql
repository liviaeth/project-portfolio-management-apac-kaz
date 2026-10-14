-- Invite-only access control.
--
-- Before this migration every policy on the business tables read
-- "TO authenticated USING (true)", so any account -- including one created
-- by posting straight to /auth/v1/signup with the public key that ships in
-- the client bundle -- had full read/write/delete on all portfolio data.
--
-- After this migration, being authenticated grants nothing on its own.
-- Access requires a row in public.app_members linked to your auth user.

-- ---------------------------------------------------------------------------
-- Membership table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null until the invited person signs up and the invite is claimed.
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

-- Emails are compared lowercased everywhere, so enforce uniqueness that way.
CREATE UNIQUE INDEX IF NOT EXISTS app_members_email_lower_idx
  ON public.app_members (lower(email));

-- Members may read their own row so the app can tell "no access" apart from
-- "no data". Writes are deliberately NOT granted: invites are issued from the
-- Supabase dashboard or with the service_role key, never from the browser.
GRANT SELECT ON public.app_members TO authenticated;
GRANT ALL ON public.app_members TO service_role;

ALTER TABLE public.app_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read own membership" ON public.app_members;
CREATE POLICY "Members can read own membership" ON public.app_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Membership predicate used by every policy below
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_members m WHERE m.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member() TO authenticated;

-- ---------------------------------------------------------------------------
-- Link a new signup to its pending invite. No invite means no access.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_members
     SET user_id = NEW.id,
         claimed_at = now()
   WHERE user_id IS NULL
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Re-gate the business tables on membership instead of on authentication
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Team can read projects" ON public.projects;
DROP POLICY IF EXISTS "Team can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Team can update projects" ON public.projects;
DROP POLICY IF EXISTS "Team can delete projects" ON public.projects;

CREATE POLICY "Members can read projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Members can update projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.is_member()) WITH CHECK (public.is_member());
CREATE POLICY "Members can delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.is_member());

DROP POLICY IF EXISTS "Team can read ridac" ON public.ridac_items;
DROP POLICY IF EXISTS "Team can insert ridac" ON public.ridac_items;
DROP POLICY IF EXISTS "Team can update ridac" ON public.ridac_items;
DROP POLICY IF EXISTS "Team can delete ridac" ON public.ridac_items;

CREATE POLICY "Members can read ridac" ON public.ridac_items
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert ridac" ON public.ridac_items
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Members can update ridac" ON public.ridac_items
  FOR UPDATE TO authenticated USING (public.is_member()) WITH CHECK (public.is_member());
CREATE POLICY "Members can delete ridac" ON public.ridac_items
  FOR DELETE TO authenticated USING (public.is_member());

DROP POLICY IF EXISTS "Team can read milestones" ON public.milestones;
DROP POLICY IF EXISTS "Team can insert milestones" ON public.milestones;
DROP POLICY IF EXISTS "Team can update milestones" ON public.milestones;
DROP POLICY IF EXISTS "Team can delete milestones" ON public.milestones;

CREATE POLICY "Members can read milestones" ON public.milestones
  FOR SELECT TO authenticated USING (public.is_member());
CREATE POLICY "Members can insert milestones" ON public.milestones
  FOR INSERT TO authenticated WITH CHECK (public.is_member());
CREATE POLICY "Members can update milestones" ON public.milestones
  FOR UPDATE TO authenticated USING (public.is_member()) WITH CHECK (public.is_member());
CREATE POLICY "Members can delete milestones" ON public.milestones
  FOR DELETE TO authenticated USING (public.is_member());

-- ---------------------------------------------------------------------------
-- REVIEW THIS BLOCK BEFORE APPLYING.
--
-- It grandfathers in every account that already exists, so that applying this
-- migration cannot lock you out of your own app. If strangers have already
-- signed up, they are carried over too. After applying, run:
--
--   SELECT email, created_at, claimed_at FROM public.app_members ORDER BY created_at;
--
-- and delete anyone you do not recognise:
--
--   DELETE FROM public.app_members WHERE lower(email) = lower('someone@example.com');
--
-- To grandfather only yourself instead, replace the statement below with a
-- single INSERT naming your own address.
-- ---------------------------------------------------------------------------

INSERT INTO public.app_members (user_id, email, role, invited_by, claimed_at)
SELECT u.id, lower(u.email), 'owner', 'migration:grandfathered', now()
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
