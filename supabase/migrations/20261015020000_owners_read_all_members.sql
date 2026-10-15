-- The only SELECT policy on app_members restricted every reader to their own
-- row (user_id = auth.uid()), including owners. That made invites silently
-- disappear from the /admin member list even when they succeeded: the row
-- existed (proven by the unique-email constraint catching a repeat invite),
-- it just wasn't visible. Add a second, permissive policy so owners can see
-- every row; everyone else still only sees their own, unchanged.

DROP POLICY IF EXISTS "Owners can read all members" ON public.app_members;
CREATE POLICY "Owners can read all members" ON public.app_members
  FOR SELECT TO authenticated
  USING (public.is_owner());
