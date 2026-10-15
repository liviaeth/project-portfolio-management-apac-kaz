-- Let owners manage membership directly, with no privileged key anywhere.
--
-- Lovable Cloud does not expose a usable SUPABASE_SERVICE_ROLE_KEY to this
-- app's server runtime (confirmed in production: "Missing Supabase
-- environment variable(s): SUPABASE_SERVICE_ROLE_KEY. Connect Supabase in
-- Lovable Cloud."), so the admin-API-based invite flow (create the account
-- server-side with a temp password) cannot work here, locally or deployed.
--
-- Invites now work like this instead:
--   1. An owner inserts a pending row (user_id NULL) from the /admin page.
--   2. The invited person signs themselves up at /auth with that email,
--      choosing their own password.
--   3. handle_new_user's trigger claims the pending row by email on signup.
-- No service_role key is involved at any step.

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_members m WHERE m.user_id = auth.uid() AND m.role = 'owner'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

GRANT INSERT, DELETE ON public.app_members TO authenticated;

DROP POLICY IF EXISTS "Owners can invite members" ON public.app_members;
CREATE POLICY "Owners can invite members" ON public.app_members
  FOR INSERT TO authenticated
  -- user_id must be NULL: every client-created row is a pending invite,
  -- claimed later by the trigger -- never a direct link to an existing user.
  WITH CHECK (public.is_owner() AND user_id IS NULL);

DROP POLICY IF EXISTS "Owners can revoke members" ON public.app_members;
CREATE POLICY "Owners can revoke members" ON public.app_members
  FOR DELETE TO authenticated
  USING (public.is_owner());
