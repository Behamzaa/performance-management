-- Performance Management Dashboard Schema
-- Run this in Supabase SQL Editor

-- Import snapshots (preserves history)
CREATE TABLE IF NOT EXISTS import_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at TIMESTAMPTZ DEFAULT now(),
  filename TEXT NOT NULL,
  raw_data JSONB,
  kpi_count INTEGER NOT NULL DEFAULT 0,
  project_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

-- KPIs (current state, replaced on each import)
CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block TEXT NOT NULL,
  name TEXT NOT NULL,
  sub_label TEXT,
  parent_kpi_id UUID REFERENCES kpis(id),
  owner TEXT,
  link TEXT,
  format TEXT DEFAULT 'num',
  lower_is_better BOOLEAN DEFAULT false,
  baseline_oct NUMERIC,
  baseline_nov NUMERIC,
  baseline_dec NUMERIC,
  target_jan NUMERIC,
  target_feb NUMERIC,
  target_mar NUMERIC,
  target_apr NUMERIC,
  target_may NUMERIC,
  target_jun NUMERIC,
  weekly_actuals JSONB DEFAULT '[]',
  final_jan NUMERIC,
  final_feb NUMERIC,
  final_mar NUMERIC,
  final_apr NUMERIC,
  final_may NUMERIC,
  final_jun NUMERIC,
  variation NUMERIC,
  performance TEXT,
  raw_values JSONB,
  import_snapshot_id UUID REFERENCES import_snapshots(id),
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority INTEGER,
  block TEXT NOT NULL,
  name TEXT NOT NULL,
  link TEXT,
  owner TEXT,
  status_jan TEXT,
  status_feb TEXT,
  status_mar TEXT,
  status_apr TEXT,
  status_may TEXT,
  status_jun TEXT,
  comment_jan TEXT,
  comment_feb TEXT,
  comment_mar TEXT,
  comment_apr TEXT,
  comment_may TEXT,
  comment_jun TEXT,
  import_snapshot_id UUID REFERENCES import_snapshots(id),
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Business Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  period_label TEXT NOT NULL,
  kpi_snapshot JSONB NOT NULL DEFAULT '[]',
  project_snapshot JSONB NOT NULL DEFAULT '[]',
  off_track_kpis JSONB,
  stalled_projects JSONB,
  commentary TEXT,
  ai_narrative TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE import_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Permissive policies (single-user app)
CREATE POLICY "Allow all on import_snapshots" ON import_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on kpis" ON kpis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);

-- Milestones (custom milestones per project per month)
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month IN ('jan', 'feb', 'mar', 'apr', 'may', 'jun')),
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on milestones" ON milestones FOR ALL USING (true) WITH CHECK (true);

-- Hidden KPIs (user preference to hide specific KPIs from the board)
CREATE TABLE IF NOT EXISTS hidden_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kpi_id)
);

ALTER TABLE hidden_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on hidden_kpis" ON hidden_kpis FOR ALL USING (true) WITH CHECK (true);
