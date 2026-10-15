-- The only thing stopping an owner from deleting their own app_members row
-- was a JavaScript string comparison in admin.tsx -- exactly the kind of
-- thing that can silently fail (case, whitespace, a stale prop) and cause a
-- real lockout, which is what very likely just happened. Move both
-- self-removal and last-owner protection into the database, where they hold
-- no matter what the client does or how the row is deleted.

-- 1. No one can delete their own row via the client. Pending invites
--    (user_id IS NULL) are unaffected -- "distinct from" treats NULL as
--    distinct from any real uid, so revoking an unclaimed invite still works.
DROP POLICY IF EXISTS "Owners can revoke members" ON public.app_members;
CREATE POLICY "Owners can revoke members" ON public.app_members
  FOR DELETE TO authenticated
  USING (public.is_owner() AND user_id IS DISTINCT FROM auth.uid());

-- 2. The last owner can't be removed by anyone, through any path (the app,
--    the SQL editor, a future admin tool) -- this runs on every DELETE.
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF (SELECT count(*) FROM public.app_members WHERE role = 'owner' AND id <> OLD.id) = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal ON public.app_members;
CREATE TRIGGER trg_prevent_last_owner_removal
  BEFORE DELETE ON public.app_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_removal();
