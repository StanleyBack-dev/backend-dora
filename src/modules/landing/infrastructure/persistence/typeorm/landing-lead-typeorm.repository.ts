import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { MoreThanOrEqual, type DataSource } from "typeorm";
import type { LandingLeadRepositoryPort } from "@/modules/landing/application/ports/landing-lead-repository.port";
import type {
  Lead,
  LeadAttribution,
  LeadDraft,
  LeadMailStatus,
} from "@/modules/landing/domain/landing-lead";
import { LandingLeadOrmEntity } from "@/modules/landing/infrastructure/persistence/typeorm/landing-lead.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toLead = (row: LandingLeadOrmEntity): Lead => ({ ...row });

@Injectable()
export class LandingLeadTypeormRepository implements LandingLeadRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get repository() {
    return this.dataSource.getRepository(LandingLeadOrmEntity);
  }

  async create(lead: LeadDraft & LeadAttribution): Promise<Lead> {
    const saved = await this.repository.save(this.repository.create(lead));
    return toLead(saved);
  }

  async setMailStatus(id: string, status: LeadMailStatus): Promise<void> {
    await this.repository.update({ id }, { mailStatus: status });
  }

  hasDuplicateSince(
    email: string,
    message: string,
    since: Date,
  ): Promise<boolean> {
    return this.repository.exists({
      where: { email, message, createdAt: MoreThanOrEqual(since) },
    });
  }

  async list(since: Date, page: PageRequest): Promise<Paginated<Lead>> {
    const [rows, total] = await this.repository.findAndCount({
      where: { createdAt: MoreThanOrEqual(since) },
      order: { createdAt: "DESC" },
      skip: (page.page - 1) * page.limit,
      take: page.limit,
    });
    return paginate(rows.map(toLead), total, page);
  }
}
