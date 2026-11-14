import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  BookingMetrics,
  EngagementMetrics,
  HealthMetrics,
  MetricsQuery,
  PlatformMetrics,
  PlatformMetricsReaderPort,
  SpaceMetrics,
  SpaceUsage,
} from "@/modules/platform-metrics/application/ports/platform-metrics-reader.port";
import { MetricsGranularity } from "@/modules/platform-metrics/domain/metrics-period";

/** Optional condominium filter: `param` holds a uuid or null (every one). */
const scope = (alias: string, param: string) =>
  `(${param}::uuid IS NULL OR ${alias}.idtb_condominiums = ${param}::uuid)`;
/** Bookings that hold a slot (counted for usage). */
const ACTIVE = `b.status IN ('PENDING', 'CONFIRMED')`;
/** Bookings whose slot starts in the period ($1 start, $2 end). */
const IN_PERIOD = `b.starts_at >= $1 AND b.starts_at < $2`;

const TRUNC: Record<MetricsGranularity, string> = {
  [MetricsGranularity.DAY]: "day",
  [MetricsGranularity.WEEK]: "week",
  [MetricsGranularity.MONTH]: "month",
};

/** Length of the ranked lists (most booked, unused, inactive…). */
const LIST_LIMIT = 10;

type Raw = Record<string, unknown>;
const int = (value: unknown) => Number(value ?? 0);

// Reporting queries for the platform panel: read-only, across the tables of
// condominiums, identity, enrollment, spaces, bookings, support and outbox.
// Every value is a bound parameter (time zone and bucket size included).
@Injectable()
export class PlatformMetricsSqlReader implements PlatformMetricsReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(query: MetricsQuery): Promise<PlatformMetrics> {
    const [bookings, spaces, engagement, health] = await Promise.all([
      this.bookings(query),
      this.spaces(query),
      this.engagement(query),
      this.health(query),
    ]);
    return { bookings, spaces, engagement, health };
  }

  private async bookings(query: MetricsQuery): Promise<BookingMetrics> {
    const { start, end, condominiumId, timeZone, now, period } = query;
    const [totals, series, byCondominium] = await Promise.all([
      this.dataSource.query<Raw[]>(
        `SELECT count(*) AS total,
                count(*) FILTER (WHERE b.status = 'CONFIRMED') AS confirmed,
                count(*) FILTER (WHERE b.status = 'PENDING') AS pending,
                count(*) FILTER (WHERE b.status = 'CANCELLED') AS cancelled,
                count(*) FILTER (WHERE b.status = 'REJECTED') AS rejected,
                (SELECT count(*) FROM tb_bookings b
                  WHERE b.status = 'PENDING' AND ${scope("b", "$3")}
                    AND b.created_at < $4::timestamptz - interval '48 hours'
                    AND b.starts_at > $4::timestamptz) AS "stalePending"
           FROM tb_bookings b
          WHERE ${IN_PERIOD} AND ${scope("b", "$3")}`,
        [start, end, condominiumId, now],
      ),
      // Every bucket of the period, empty ones included. A bucket that
      // starts before the period (week/month) is labelled with its first
      // day inside it.
      this.dataSource.query<Raw[]>(
        `WITH buckets AS (
           SELECT gs::date AS bucket
             FROM generate_series(
               date_trunc($5, $6::date::timestamp),
               $7::date::timestamp,
               ('1 ' || $5)::interval) gs)
         SELECT to_char(greatest(k.bucket, $6::date), 'YYYY-MM-DD') AS bucket,
                count(b.idtb_bookings) AS total,
                count(b.idtb_bookings) FILTER (WHERE b.status = 'CANCELLED')
                  AS cancelled
           FROM buckets k
           LEFT JOIN tb_bookings b
             ON date_trunc($5, b.starts_at AT TIME ZONE $4)::date = k.bucket
            AND ${IN_PERIOD} AND ${scope("b", "$3")}
          GROUP BY k.bucket
          ORDER BY k.bucket`,
        [
          start,
          end,
          condominiumId,
          timeZone,
          TRUNC[period.granularity],
          period.from,
          period.to,
        ],
      ),
      this.dataSource.query<Raw[]>(
        `SELECT c.idtb_condominiums AS "condominiumId", c.name,
                count(*) AS total,
                count(*) FILTER (WHERE b.status = 'CANCELLED') AS cancelled
           FROM tb_bookings b
           JOIN tb_condominiums c ON c.idtb_condominiums = b.idtb_condominiums
          WHERE ${IN_PERIOD} AND ${scope("b", "$3")}
          GROUP BY c.idtb_condominiums, c.name
          ORDER BY total DESC, unaccent(c.name)
          LIMIT ${LIST_LIMIT}`,
        [start, end, condominiumId],
      ),
    ]);
    const row = totals[0] ?? {};
    return {
      total: int(row.total),
      confirmed: int(row.confirmed),
      pending: int(row.pending),
      cancelled: int(row.cancelled),
      rejected: int(row.rejected),
      stalePending: int(row.stalePending),
      granularity: period.granularity,
      series: series.map((point) => ({
        bucket: String(point.bucket),
        total: int(point.total),
        cancelled: int(point.cancelled),
      })),
      byCondominium: byCondominium.map((item) => ({
        condominiumId: String(item.condominiumId),
        name: String(item.name),
        total: int(item.total),
        cancelled: int(item.cancelled),
      })),
    };
  }

  private async spaces(query: MetricsQuery): Promise<SpaceMetrics> {
    const { start, end, condominiumId, timeZone } = query;
    const [usage, weekdays, hours] = await Promise.all([
      // Spaces of active condominiums with their active bookings.
      this.dataSource.query<Raw[]>(
        `SELECT s.idtb_spaces AS "spaceId", s.name, s.active,
                c.name AS "condominiumName",
                count(b.idtb_bookings) AS bookings,
                coalesce(sum(extract(epoch FROM b.ends_at - b.starts_at)), 0)
                  / 3600 AS hours
           FROM tb_spaces s
           JOIN tb_condominiums c ON c.idtb_condominiums = s.idtb_condominiums
           LEFT JOIN tb_bookings b
             ON b.idtb_spaces = s.idtb_spaces AND ${ACTIVE} AND ${IN_PERIOD}
          WHERE c.status = 'ACTIVE' AND ${scope("s", "$3")}
          GROUP BY s.idtb_spaces, s.name, s.active, c.name
          ORDER BY bookings DESC, unaccent(s.name)`,
        [start, end, condominiumId],
      ),
      this.dataSource.query<Raw[]>(
        `SELECT extract(dow FROM b.starts_at AT TIME ZONE $4)::int AS weekday,
                count(*) AS bookings
           FROM tb_bookings b
          WHERE ${ACTIVE} AND ${IN_PERIOD} AND ${scope("b", "$3")}
          GROUP BY 1`,
        [start, end, condominiumId, timeZone],
      ),
      this.dataSource.query<Raw[]>(
        `SELECT extract(hour FROM b.starts_at AT TIME ZONE $4)::int AS hour,
                count(*) AS bookings
           FROM tb_bookings b
          WHERE ${ACTIVE} AND ${IN_PERIOD} AND ${scope("b", "$3")}
          GROUP BY 1
          ORDER BY 1`,
        [start, end, condominiumId, timeZone],
      ),
    ]);

    const spaces = usage.map((row) => ({
      active: row.active === true,
      usage: {
        spaceId: String(row.spaceId),
        name: String(row.name),
        condominiumName: String(row.condominiumName),
        bookings: int(row.bookings),
        hours: Math.round(Number(row.hours ?? 0) * 10) / 10,
      } satisfies SpaceUsage,
    }));
    const active = spaces.filter((space) => space.active);
    const unused = active.filter((space) => space.usage.bookings === 0);
    const perWeekday = new Map(
      weekdays.map((row) => [int(row.weekday), int(row.bookings)]),
    );
    return {
      activeSpaces: active.length,
      mostUsed: spaces
        .filter((space) => space.usage.bookings > 0)
        .slice(0, LIST_LIMIT)
        .map((space) => space.usage),
      unused: unused.slice(0, LIST_LIMIT).map((space) => space.usage),
      unusedCount: unused.length,
      byWeekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        bookings: perWeekday.get(weekday) ?? 0,
      })),
      byHour: hours.map((row) => ({
        hour: int(row.hour),
        bookings: int(row.bookings),
      })),
    };
  }

  private async engagement(query: MetricsQuery): Promise<EngagementMetrics> {
    const { start, end, condominiumId, now } = query;
    // Members with access: active membership, active account and an active
    // condominium. A person in two condominiums counts once.
    const members = `FROM tb_memberships m
           JOIN tb_users u ON u.idtb_users = m.idtb_users
           JOIN tb_condominiums c ON c.idtb_condominiums = m.idtb_condominiums
          WHERE m.active AND u.active AND c.status = 'ACTIVE'
            AND ${scope("m", "$3")}`;
    const [counts, inactive] = await Promise.all([
      this.dataSource.query<Raw[]>(
        `SELECT
           (SELECT count(DISTINCT u.idtb_users) ${members}) AS members,
           (SELECT count(DISTINCT u.idtb_users) ${members}
              AND u.last_login_at >= $4::timestamptz - interval '7 days')
              AS "active7d",
           (SELECT count(DISTINCT u.idtb_users) ${members}
              AND u.last_login_at >= $4::timestamptz - interval '30 days')
              AS "active30d",
           (SELECT count(*) FROM tb_memberships m
             WHERE m.created_at >= $1 AND m.created_at < $2
               AND ${scope("m", "$3")}) AS "newMembers",
           (SELECT count(*) FROM tb_enrollment_requests e
             WHERE e.created_at >= $1 AND e.created_at < $2
               AND ${scope("e", "$3")}) AS enrollments`,
        [start, end, condominiumId, now],
      ),
      // Active condominiums where no member signed in for 30 days.
      this.dataSource.query<Raw[]>(
        `SELECT c.idtb_condominiums AS "condominiumId", c.name,
                max(u.last_login_at) AS "lastActivityAt",
                count(*) OVER () AS "totalCount"
           FROM tb_condominiums c
           LEFT JOIN tb_memberships m
             ON m.idtb_condominiums = c.idtb_condominiums AND m.active
           LEFT JOIN tb_users u ON u.idtb_users = m.idtb_users AND u.active
          WHERE c.status = 'ACTIVE' AND ${scope("c", "$1")}
          GROUP BY c.idtb_condominiums, c.name
         HAVING max(u.last_login_at) IS NULL
             OR max(u.last_login_at) < $2::timestamptz - interval '30 days'
          ORDER BY max(u.last_login_at) NULLS FIRST, unaccent(c.name)
          LIMIT ${LIST_LIMIT}`,
        [condominiumId, now],
      ),
    ]);
    const row = counts[0] ?? {};
    return {
      members: int(row.members),
      active7d: int(row.active7d),
      active30d: int(row.active30d),
      newMembers: int(row.newMembers),
      enrollments: int(row.enrollments),
      inactiveCondominiums: inactive.map((item) => ({
        condominiumId: String(item.condominiumId),
        name: String(item.name),
        lastActivityAt: item.lastActivityAt
          ? new Date(item.lastActivityAt as string)
          : null,
      })),
      inactiveCount: int(inactive[0]?.totalCount),
    };
  }

  // Current state, not the period: what needs attention now.
  private async health(query: MetricsQuery): Promise<HealthMetrics> {
    const [row] = await this.dataSource.query<Raw[]>(
      `SELECT
         (SELECT count(*) FROM tb_enrollment_requests e
           WHERE e.status = 'PENDENTE' AND ${scope("e", "$1")}
             AND e.created_at < $2::timestamptz - interval '3 days')
           AS "staleEnrollments",
         (SELECT count(*) FROM tb_outbox WHERE status = 'FAILED')
           AS "failedNotifications",
         (SELECT count(*) FROM tb_outbox
           WHERE status = 'PENDING'
             AND created_at < $2::timestamptz - interval '1 hour')
           AS "delayedNotifications",
         (SELECT count(*) FROM tb_condominiums c
           WHERE c.status = 'ACTIVE' AND ${scope("c", "$1")}
             AND NOT EXISTS (
               SELECT 1 FROM tb_memberships m
                 JOIN tb_users u ON u.idtb_users = m.idtb_users
                WHERE m.idtb_condominiums = c.idtb_condominiums
                  AND m.role = 'ADMIN' AND m.active AND u.active))
           AS "withoutManager",
         (SELECT count(*) FROM tb_condominiums c
           WHERE c.status = 'ACTIVE' AND ${scope("c", "$1")}
             AND NOT EXISTS (SELECT 1 FROM tb_units t
                              WHERE t.idtb_condominiums = c.idtb_condominiums))
           AS "withoutUnits",
         (SELECT count(*) FROM tb_support_requests r
           WHERE r.status = 'ABERTO' AND ${scope("r", "$1")}) AS "openSupport"`,
      [query.condominiumId, query.now],
    );
    return {
      staleEnrollments: int(row?.staleEnrollments),
      failedNotifications: int(row?.failedNotifications),
      delayedNotifications: int(row?.delayedNotifications),
      withoutManager: int(row?.withoutManager),
      withoutUnits: int(row?.withoutUnits),
      openSupport: int(row?.openSupport),
    };
  }
}
