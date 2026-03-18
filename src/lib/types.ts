export type KpiStatus = "green" | "amber" | "red" | "nodata";

export interface Kpi {
  id: string;
  block: string;
  name: string;
  sub_label: string | null;
  parent_kpi_id: string | null;
  owner: string | null;
  link: string | null;
  format: "num" | "pct" | "pct4" | "composite" | "currency";
  lower_is_better: boolean;
  baseline_oct: number | null;
  baseline_nov: number | null;
  baseline_dec: number | null;
  target_jan: number | null;
  target_feb: number | null;
  target_mar: number | null;
  target_apr: number | null;
  target_may: number | null;
  target_jun: number | null;
  weekly_actuals: { week: number; value: number | null }[];
  final_jan: number | null;
  final_feb: number | null;
  final_mar: number | null;
  final_apr: number | null;
  final_may: number | null;
  final_jun: number | null;
  variation: number | null;
  performance: string | null;
  raw_values: Record<string, string> | null;
  import_snapshot_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  priority: number | null;
  block: string;
  name: string;
  link: string | null;
  owner: string | null;
  status_jan: string | null;
  status_feb: string | null;
  status_mar: string | null;
  status_apr: string | null;
  status_may: string | null;
  status_jun: string | null;
  comment_jan: string | null;
  comment_feb: string | null;
  comment_mar: string | null;
  comment_apr: string | null;
  comment_may: string | null;
  comment_jun: string | null;
  import_snapshot_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  cadence: "weekly" | "monthly";
  period_label: string;
  kpi_snapshot: Kpi[];
  project_snapshot: Project[];
  off_track_kpis: OffTrackKpi[] | null;
  stalled_projects: StalledProject[] | null;
  commentary: string | null;
  ai_narrative: string | null;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportSnapshot {
  id: string;
  imported_at: string;
  filename: string;
  kpi_count: number;
  project_count: number;
  notes: string | null;
}

export interface StatusResult {
  status: KpiStatus;
  deviation: number | null;
  deviationLabel: string;
}

export interface BlockSummary {
  block: string;
  total: number;
  green: number;
  amber: number;
  red: number;
  nodata: number;
  healthPct: number;
  topAlert: { name: string; deviation: number; owner: string | null } | null;
}

export interface OffTrackKpi {
  block: string;
  name: string;
  target: number | null;
  actual: number | null;
  deviation: string;
  owner: string | null;
  status: KpiStatus;
}

export interface StalledProject {
  block: string;
  name: string;
  owner: string | null;
  status: string | null;
  comment: string | null;
}

export const BLOCK_ORDER = [
  "NORTH STARS",
  "GROWTH",
  "QC & BADS",
  "OPS",
  "LOPS",
  "COMMERCIAL",
  "F&S",
  "PEOPLE",
  "BAds",
  "GA",
] as const;

export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun"] as const;
export type Month = (typeof MONTHS)[number];

export interface Milestone {
  id: string;
  project_id: string;
  month: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
