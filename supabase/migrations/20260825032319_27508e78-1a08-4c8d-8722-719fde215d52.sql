ALTER TABLE public.ridac_items
  ADD COLUMN IF NOT EXISTS submission_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS risk_response text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS likelihood text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  detail text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  phase text NOT NULL DEFAULT 'Design',
  status text NOT NULL DEFAULT 'Not Started',
  progress integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read milestones" ON public.milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team can insert milestones" ON public.milestones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team can update milestones" ON public.milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Team can delete milestones" ON public.milestones FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;