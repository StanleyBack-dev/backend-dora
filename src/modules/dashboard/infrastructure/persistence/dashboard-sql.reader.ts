import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  Dashboard,
  DashboardReaderPort,
} from "@/modules/dashboard/application/dashboard";

// Reporting query: reads (never writes) the tables of identity, enrollment,
// support and outbox in a single statement.
@Injectable()
export class DashboardSqlReader implements DashboardReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async read(): Promise<Dashboard> {
    const [row] = await this.dataSource.query<
      Record<keyof Dashboard, number>[]
    >(
      `SELECT
         (SELECT count(*)::int FROM tb_users WHERE active) AS "activeUsers",
         (SELECT count(*)::int FROM tb_enrollment_requests
           WHERE status = 'PENDENTE') AS "pendingEnrollments",
         (SELECT count(*)::int FROM tb_support_requests
           WHERE status = 'ABERTO') AS "openSupportRequests",
         (SELECT count(*)::int FROM tb_outbox
           WHERE status = 'FAILED') AS "failedNotifications"`,
    );
    return row;
  }
}
