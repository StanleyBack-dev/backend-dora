import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { LandingEventRepositoryPort } from "@/modules/landing/application/ports/landing-event-repository.port";
import type { LandingEventBatch } from "@/modules/landing/domain/landing-event";

const COLUMNS = 10;

// tb_landing_events is append-only and written in bulk: one INSERT per
// beacon, no entity round trip.
@Injectable()
export class LandingEventSqlRepository implements LandingEventRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async insertBatch(batch: LandingEventBatch): Promise<void> {
    const params: unknown[] = [];
    const rows = batch.events.map((event, index) => {
      params.push(
        batch.visitorId,
        batch.sessionId,
        event.type,
        event.name,
        event.path,
        batch.referrerHost,
        batch.utmSource,
        batch.utmMedium,
        batch.utmCampaign,
        batch.device,
      );
      const placeholders = Array.from(
        { length: COLUMNS },
        (_, i) => `$${index * COLUMNS + i + 1}`,
      );
      return `(${placeholders.join(", ")})`;
    });
    await this.dataSource.query(
      `INSERT INTO tb_landing_events
         (visitor_id, session_id, type, name, path, referrer_host,
          utm_source, utm_medium, utm_campaign, device)
       VALUES ${rows.join(", ")}`,
      params,
    );
  }
}
