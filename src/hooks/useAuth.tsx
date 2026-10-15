import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  // Tracks the signed-in user id across renders so a change can be detected
  // without this effect re-running on every qc/function identity change.
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const applySession = (s: Session | null) => {
      const uid = s?.user?.id ?? null;
      // Membership, projects, RIDAC items -- every cached query -- belongs
      // to whoever was signed in when it was fetched. useMembership/useIsMember
      // in particular cache for 60s under a key with no user in it, so without
      // this, signing out and into a different account in the same tab could
      // show the previous user's role or data until that cache naturally expired.
      if (lastUserId.current !== null && uid !== lastUserId.current) {
        qc.clear();
      }
      lastUserId.current = uid;
      setSession(s);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}
