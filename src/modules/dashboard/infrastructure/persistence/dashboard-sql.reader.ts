import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  Dashboard,
  DashboardReaderPort,
  ParcelIndicators,
  ParcelIndicatorsWindow,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";

// Reporting query: reads (never writes) the tables of identity, enrollment,
// condominiums, spaces, bookings, support and outbox in a single statement. Support and outbox
// are the platform's, so only the platform administrator gets them. The
// parcels indicators are a second read, only where the module is on.
@Injectable()
export class DashboardSqlReader implements DashboardReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(
    condominiumId: string,
    platform: boolean,
    today: { from: Date; to: Date },
  ): Promise<Omit<Dashboard, "parcels">> {
    const [row] = await this.dataSource.query<Omit<Dashboard, "parcels">[]>(
      `SELECT
         (SELECT count(*)::int FROM tb_memberships m
            JOIN tb_users u ON u.idtb_users = m.idtb_users
           WHERE m.idtb_condominiums = $1 AND m.active AND u.active
             AND m.kind = 'RESIDENT')
           AS "activeUsers",
         (SELECT count(*)::int FROM tb_enrollment_requests
           WHERE idtb_condominiums = $1 AND status = 'PENDENTE')
           AS "pendingEnrollments",
         (SELECT count(*)::int FROM tb_units WHERE idtb_condominiums = $1)
           AS "units",
         (SELECT count(*)::int FROM tb_spaces
           WHERE idtb_condominiums = $1 AND active) AS "activeSpaces",
         (SELECT count(*)::int FROM tb_bookings
           WHERE idtb_condominiums = $1 AND status = 'PENDING'
             AND starts_at > now()) AS "pendingBookings",
         (SELECT count(*)::int FROM tb_bookings
           WHERE idtb_condominiums = $1
             AND status IN ('PENDING', 'CONFIRMED')
             AND starts_at >= $3 AND starts_at < $4) AS "bookingsToday",
         CASE WHEN $2 THEN (SELECT count(*)::int FROM tb_support_requests
           WHERE status = 'ABERTO') END AS "openSupportRequests",
         CASE WHEN $2 THEN (SELECT count(*)::int FROM tb_outbox
           WHERE status = 'FAILED') END AS "failedNotifications"`,
      [condominiumId, platform, today.from, today.to],
    );
    return row as Omit<Dashboard, "parcels">;
  }

  async parcels(
    condominiumId: string,
    window: ParcelIndicatorsWindow,
  ): Promise<ParcelIndicators> {
    const [[counts], monthly] = await Promise.all([
      this.dataSource.query<
        {
          waiting: number;
          stuck: number;
          perishableOverdue: number;
          pickedUpLast30Days: number;
          averagePickupHours: string | null;
        }[]
      >(
        `SELECT
           count(*) FILTER (WHERE status = 'RECEIVED')::int AS waiting,
           count(*) FILTER (WHERE status = 'RECEIVED' AND received_at < $2)::int
             AS stuck,
           count(*) FILTER (WHERE status = 'RECEIVED' AND pickup_deadline <= $3)::int
             AS "perishableOverdue",
           count(*) FILTER (WHERE status = 'PICKED_UP' AND closed_at >= $4)::int
             AS "pickedUpLast30Days",
           round((avg(extract(epoch FROM closed_at - received_at) / 3600)
             FILTER (WHERE status = 'PICKED_UP' AND closed_at >= $4))::numeric, 1)
             AS "averagePickupHours"
         FROM tb_parcels WHERE idtb_condominiums = $1`,
        [condominiumId, window.stuckBefore, window.now, window.since30Days],
      ),
      // The last 6 months in the condominium's calendar, empty ones too.
      this.dataSource.query<
        { month: string; received: number; pickedUp: number }[]
      >(
        `WITH months AS (
           SELECT generate_series(
             date_trunc('month', $2::timestamptz AT TIME ZONE $3) - interval '5 months',
             date_trunc('month', $2::timestamptz AT TIME ZONE $3),
             interval '1 month') AS month
         )
         SELECT to_char(m.month, 'YYYY-MM') AS month,
                count(p.idtb_parcels)::int AS received,
                count(p.idtb_parcels) FILTER (WHERE p.status = 'PICKED_UP')::int
                  AS "pickedUp"
           FROM months m
           LEFT JOIN tb_parcels p
             ON p.idtb_condominiums = $1
            AND date_trunc('month', p.received_at AT TIME ZONE $3) = m.month
          GROUP BY m.month ORDER BY m.month`,
        [condominiumId, window.now, window.timeZone],
      ),
    ]);
    return {
      waiting: counts?.waiting ?? 0,
      stuck: counts?.stuck ?? 0,
      perishableOverdue: counts?.perishableOverdue ?? 0,
      pickedUpLast30Days: counts?.pickedUpLast30Days ?? 0,
      averagePickupHours:
        counts?.averagePickupHours != null
          ? Number(counts.averagePickupHours)
          : null,
      monthly,
    };
  }
}
