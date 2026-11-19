import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  LandingMetrics,
  LandingMetricsReaderPort,
  LandingRank,
} from "@/modules/landing/application/ports/landing-metrics-reader.port";
import {
  CONTACT_TARGETS,
  LandingEventType as T,
} from "@/modules/landing/domain/landing-event";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

type Raw = Record<string, unknown>;
const int = (value: unknown) => Number(value ?? 0);

/** Rows since the first day of the period ($1 = days, $2 = time zone). */
const SINCE = `created_at >= (((now() AT TIME ZONE $2::text)::date - ($1::int - 1))::timestamp AT TIME ZONE $2::text)`;

const LIST_LIMIT = 20;

const rank = (rows: Raw[]): LandingRank[] =>
  rows.map((row) => ({
    name: String(row.name ?? "") || "(direto)",
    total: int(row.total),
    visitors: int(row.visitors),
  }));

// Reporting queries for the landing panel, read-only over tb_landing_events
// and tb_landing_leads. Every value is a bound parameter.
@Injectable()
export class LandingMetricsSqlReader implements LandingMetricsReaderPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async read(days: number): Promise<LandingMetrics> {
    const p = [days, this.clock.timeZone];
    const q = (sql: string, params: unknown[] = p) =>
      this.dataSource.query<Raw[]>(sql, params);
    // Events grouped by `column`: occurrences and distinct visitors.
    const grouped = (column: string, where: string, limit = LIST_LIMIT) =>
      q(
        `SELECT ${column} AS name, count(*) AS total,
                count(DISTINCT visitor_id) AS visitors
           FROM tb_landing_events
          WHERE ${SINCE} AND ${where}
          GROUP BY 1 ORDER BY visitors DESC, total DESC
          LIMIT ${limit}`,
      );
    const contactTarget = `split_part(name, ':', 1) = ANY($3)`;

    const [
      [totals],
      [leads],
      daily,
      pages,
      sections,
      clicks,
      contacts,
      videos,
      scrollDepth,
      referrers,
      campaigns,
      devices,
      leadSubjects,
    ] = await Promise.all([
      q(
        `SELECT count(DISTINCT visitor_id) AS visitors,
                count(DISTINCT session_id) AS sessions,
                count(*) FILTER (WHERE type = '${T.PAGE_VIEW}') AS page_views,
                count(*) FILTER (WHERE type = '${T.CLICK}' AND ${contactTarget}) AS contact_clicks,
                count(*) FILTER (WHERE type = '${T.VIDEO_PLAY}') AS video_plays,
                count(DISTINCT session_id) FILTER (WHERE type = '${T.FORM_START}') AS form_starts,
                count(*) FILTER (WHERE type = '${T.FORM_SUCCESS}') AS form_successes
           FROM tb_landing_events WHERE ${SINCE}`,
        [...p, CONTACT_TARGETS],
      ),
      q(`SELECT count(*) AS total FROM tb_landing_leads WHERE ${SINCE}`),
      q(
        `WITH days AS (
           SELECT generate_series(
                    (now() AT TIME ZONE $2::text)::date - ($1::int - 1),
                    (now() AT TIME ZONE $2::text)::date,
                    interval '1 day')::date AS day
         ),
         v AS (
           SELECT (created_at AT TIME ZONE $2::text)::date AS day,
                  count(DISTINCT visitor_id) AS visitors
             FROM tb_landing_events WHERE ${SINCE} GROUP BY 1
         ),
         l AS (
           SELECT (created_at AT TIME ZONE $2::text)::date AS day, count(*) AS leads
             FROM tb_landing_leads WHERE ${SINCE} GROUP BY 1
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                coalesce(v.visitors, 0) AS visitors,
                coalesce(l.leads, 0) AS leads
           FROM days LEFT JOIN v USING (day) LEFT JOIN l USING (day)
          ORDER BY days.day`,
      ),
      grouped("path", `type = '${T.PAGE_VIEW}'`),
      grouped("name", `type = '${T.SECTION_VIEW}'`),
      grouped("name", `type = '${T.CLICK}'`, 30),
      q(
        `SELECT split_part(name, ':', 1) AS name, count(*) AS total,
                count(DISTINCT visitor_id) AS visitors
           FROM tb_landing_events
          WHERE ${SINCE} AND type = '${T.CLICK}' AND ${contactTarget}
          GROUP BY 1 ORDER BY total DESC`,
        [...p, CONTACT_TARGETS],
      ),
      grouped(
        `type || ':' || coalesce(name, '')`,
        `type IN ('${T.VIDEO_PLAY}', '${T.VIDEO_COMPLETE}', '${T.DEMO_STEP}')`,
      ),
      grouped("name", `type = '${T.SCROLL_DEPTH}'`),
      grouped("referrer_host", `type = '${T.PAGE_VIEW}'`, 10),
      grouped(
        `concat_ws(' / ', utm_source, utm_medium, utm_campaign)`,
        `type = '${T.PAGE_VIEW}' AND utm_source IS NOT NULL`,
        10,
      ),
      grouped("device", `type = '${T.PAGE_VIEW}'`),
      q(
        `SELECT subject AS name, count(*) AS total, count(*) AS visitors
           FROM tb_landing_leads WHERE ${SINCE}
          GROUP BY 1 ORDER BY total DESC`,
      ),
    ]);

    return {
      days,
      totals: {
        visitors: int(totals.visitors),
        sessions: int(totals.sessions),
        pageViews: int(totals.page_views),
        leads: int(leads.total),
        contactClicks: int(totals.contact_clicks),
        videoPlays: int(totals.video_plays),
        formStarts: int(totals.form_starts),
        formSuccesses: int(totals.form_successes),
      },
      daily: daily.map((row) => ({
        day: String(row.day),
        visitors: int(row.visitors),
        leads: int(row.leads),
      })),
      pages: rank(pages),
      sections: rank(sections),
      clicks: rank(clicks),
      contacts: rank(contacts),
      videos: rank(videos),
      scrollDepth: rank(scrollDepth).sort(
        (a, b) => Number(a.name) - Number(b.name),
      ),
      referrers: rank(referrers),
      campaigns: rank(campaigns),
      devices: rank(devices),
      leadSubjects: rank(leadSubjects),
    };
  }
}
