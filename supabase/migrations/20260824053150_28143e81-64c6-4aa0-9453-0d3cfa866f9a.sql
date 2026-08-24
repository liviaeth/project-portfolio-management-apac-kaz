CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT 'Design',
  health TEXT NOT NULL DEFAULT 'Green',
  priority TEXT NOT NULL DEFAULT 'Medium',
  owner TEXT NOT NULL DEFAULT '',
  start_date DATE,
  target_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update projects" ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team can delete projects" ON public.projects FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ridac_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Risk',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  severity TEXT NOT NULL DEFAULT 'Medium',
  due_date DATE,
  resolution TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ridac_items_project_id_idx ON public.ridac_items(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ridac_items TO authenticated;
GRANT ALL ON public.ridac_items TO service_role;
ALTER TABLE public.ridac_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read ridac" ON public.ridac_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert ridac" ON public.ridac_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update ridac" ON public.ridac_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team can delete ridac" ON public.ridac_items FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_ridac_items_updated_at BEFORE UPDATE ON public.ridac_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ridac_items;

INSERT INTO public.projects (id, code, name, description, phase, health, priority, owner, start_date, target_date, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'PHX', 'Project Phoenix', 'Core platform re-architecture and rollout.', 'Build', 'Green', 'Critical', 'M. Smith', '2026-02-02', '2026-11-30', 1),
('22222222-2222-2222-2222-222222222222', 'NBC', 'Nebula Core Migration', 'Migration of legacy workloads to the new core.', 'Testing', 'Amber', 'High', 'A. Patel', '2025-09-15', '2026-09-30', 2),
('33333333-3333-3333-3333-333333333333', 'TTN', 'Titan Refresh', 'Hardware and tooling refresh across sites.', 'Design', 'Green', 'Medium', 'S. Chen', '2026-06-01', '2027-03-31', 3);

INSERT INTO public.ridac_items (project_id, ref_code, type, title, detail, owner, status, severity, due_date) VALUES
('11111111-1111-1111-1111-111111111111', 'DEC-104', 'Decision', 'Multi-region cloud strategy', 'Approved use of EU region for data sovereignty requirements.', 'M. Smith', 'Closed', 'Medium', NULL),
('11111111-1111-1111-1111-111111111111', 'ACT-211', 'Action', 'Finalise cutover runbook', 'Runbook to be reviewed with operations before go-live.', 'J. Varma', 'Open', 'High', '2026-09-12'),
('22222222-2222-2222-2222-222222222222', 'RSK-229', 'Risk', 'Third-party API instability', 'Payment gateway latency exceeding 2s in test environments.', 'K. Sato', 'Open', 'Critical', '2026-09-05'),
('22222222-2222-2222-2222-222222222222', 'DEP-014', 'Dependency', 'Infrastructure to provision prod clusters', 'Blocked awaiting infrastructure capacity approval.', 'Ops Team', 'Blocked', 'High', '2026-08-31'),
('33333333-3333-3333-3333-333333333333', 'CR-007', 'Change Request', 'Expand scope of reporting module', 'Additional filters requested by the finance team.', 'B. Miller', 'In Review', 'Medium', '2026-10-01');