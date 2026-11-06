export type Result = "works" | "minor_issues" | "major_issues" | "does_not_work";

export type Game = {
  id: string;
  title: string;
  steam_app_id: string | null;
  developer: string | null;
  publisher: string | null;
  release_year: number | null;
  created_at: string;
};

export type Compatibility = {
  game_id: string;
  report_count: number;
  works_count: number;
  minor_issues_count: number;
  major_issues_count: number;
  does_not_work_count: number;
  positive_percent: number | null;
  last_tested: string | null;
};

export type Report = {
  id: string;
  game_id: string;
  result: Result;
  mac_model: string;
  chip: string;
  memory_gb: number | null;
  macos_version: string;
  crossover_version: string;
  notproton_version: string;
  storefront: string;
  game_version: string | null;
  resolution: string | null;
  average_fps: number | null;
  session_minutes: number | null;
  multiplayer_status: string | null;
  launch_options: string | null;
  notes: string | null;
  tested_at: string;
  created_at: string;
};
