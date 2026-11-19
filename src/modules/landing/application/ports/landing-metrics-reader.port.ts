/** A ranked line: how many times, and by how many distinct visitors. */
export type LandingRank = { name: string; total: number; visitors: number };

export type LandingTotals = {
  visitors: number;
  sessions: number;
  pageViews: number;
  leads: number;
  contactClicks: number;
  videoPlays: number;
  /** Sessions that started filling the form. */
  formStarts: number;
  formSuccesses: number;
};

export type LandingDay = { day: string; visitors: number; leads: number };

export type LandingMetrics = {
  days: number;
  totals: LandingTotals;
  daily: LandingDay[];
  pages: LandingRank[];
  sections: LandingRank[];
  clicks: LandingRank[];
  contacts: LandingRank[];
  videos: LandingRank[];
  scrollDepth: LandingRank[];
  referrers: LandingRank[];
  campaigns: LandingRank[];
  devices: LandingRank[];
  leadSubjects: LandingRank[];
};

export interface LandingMetricsReaderPort {
  /** The last `days` calendar days (app timezone), today included. */
  read(days: number): Promise<LandingMetrics>;
}

export const LANDING_METRICS_READER = Symbol("LANDING_METRICS_READER");
