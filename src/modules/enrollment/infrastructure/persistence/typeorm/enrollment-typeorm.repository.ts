import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, MoreThan, type Repository } from "typeorm";
import type {
  EnrollmentRepositoryPort,
  EnrollmentRequestFilter,
  EnrollmentRequestView,
} from "@/modules/enrollment/application/ports/enrollment-repository.port";
import {
  EnrollmentStatus,
  type EnrollmentData,
  type EnrollmentInvite,
  type EnrollmentRequest,
} from "@/modules/enrollment/domain/enrollment";
import { EnrollmentInviteOrmEntity } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-invite.orm-entity";
import { EnrollmentRequestOrmEntity } from "@/modules/enrollment/infrastructure/persistence/typeorm/enrollment-request.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const REQUEST_COUNT = `(SELECT count(*) FROM tb_enrollment_requests r
  WHERE r.idtb_enrollment_invites = invite.idtb_enrollment_invites)`;

const toInvite = (
  row: EnrollmentInviteOrmEntity,
  requestCount: number,
): EnrollmentInvite => ({
  id: row.id,
  condominiumId: row.condominiumId,
  code: row.code,
  label: row.label,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  requestCount,
});

const toRequest = (row: EnrollmentRequestOrmEntity): EnrollmentRequest => ({
  id: row.id,
  condominiumId: row.condominiumId,
  inviteId: row.inviteId,
  status: row.status,
  fullName: row.fullName,
  email: row.email,
  phone: row.phone,
  unitId: row.unitId,
  consentAt: row.consentAt,
  createdAt: row.createdAt,
  reviewedBy: row.reviewedBy,
  reviewedAt: row.reviewedAt,
  rejectionReason: row.rejectionReason,
  userId: row.userId,
  photoKey: row.photoKey,
});

type UnitRaw = { unit_block: string | null; unit_number: string | null };

@Injectable()
export class EnrollmentTypeormRepository implements EnrollmentRepositoryPort {
  constructor(
    @InjectRepository(EnrollmentInviteOrmEntity)
    private readonly invites: Repository<EnrollmentInviteOrmEntity>,
    @InjectRepository(EnrollmentRequestOrmEntity)
    private readonly requests: Repository<EnrollmentRequestOrmEntity>,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  // === invites ===

  async listInvites(
    condominiumId: string,
    limit: number,
  ): Promise<EnrollmentInvite[]> {
    const { entities, raw } = await this.invites
      .createQueryBuilder("invite")
      .addSelect(REQUEST_COUNT, "request_count")
      .where("invite.idtb_condominiums = :condominiumId", { condominiumId })
      .orderBy("invite.created_at", "DESC")
      .limit(limit)
      .getRawAndEntities<{ request_count: string }>();
    return entities.map((row, index) =>
      toInvite(row, Number(raw[index]?.request_count ?? 0)),
    );
  }

  async findInvite(id: string): Promise<EnrollmentInvite | null> {
    const { entities, raw } = await this.invites
      .createQueryBuilder("invite")
      .addSelect(REQUEST_COUNT, "request_count")
      .where("invite.idtb_enrollment_invites = :id", { id })
      .getRawAndEntities<{ request_count: string }>();
    const row = entities[0];
    return row ? toInvite(row, Number(raw[0]?.request_count ?? 0)) : null;
  }

  async findOpenInviteByCode(
    code: string,
    now: Date,
  ): Promise<EnrollmentInvite | null> {
    const row = await this.invites.findOne({
      where: { code, revokedAt: IsNull(), expiresAt: MoreThan(now) },
      order: { createdAt: "DESC" },
    });
    return row ? this.findInvite(row.id) : null;
  }

  async createInvite(data: {
    condominiumId: string;
    code: string;
    label: string;
    expiresAt: Date;
    createdBy: string;
  }): Promise<EnrollmentInvite> {
    const row = await this.invites.save(this.invites.create(data));
    return toInvite(row, 0);
  }

  async revokeInvite(id: string, at: Date): Promise<EnrollmentInvite> {
    await this.invites.update({ id }, { revokedAt: at });
    const invite = await this.findInvite(id);
    if (!invite) throw new Error(`Enrollment invite ${id} vanished`);
    return invite;
  }

  // === requests ===

  // The unit's block and number come from tb_units (condominiums module),
  // read-only.
  private requestQuery() {
    return this.requests
      .createQueryBuilder("request")
      .leftJoin("tb_units", "unit", "unit.idtb_units = request.idtb_units")
      .addSelect("unit.block", "unit_block")
      .addSelect("unit.number", "unit_number");
  }

  private toView(
    row: EnrollmentRequestOrmEntity,
    raw: UnitRaw | undefined,
  ): EnrollmentRequestView {
    return {
      ...toRequest(row),
      unitBlock: raw?.unit_block ?? null,
      unitNumber: raw?.unit_number ?? null,
    };
  }

  async pageRequests(
    filter: EnrollmentRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<EnrollmentRequestView>> {
    const query = this.requestQuery()
      .where("request.idtb_condominiums = :condominiumId", {
        condominiumId: filter.condominiumId,
      })
      .orderBy("request.created_at", "DESC")
      .offset((page.page - 1) * page.limit)
      .limit(page.limit);
    if (filter.status) {
      query.andWhere("request.status = :status", { status: filter.status });
    }
    const search = filter.search?.trim();
    if (search) {
      query.andWhere(
        `(unaccent(request.full_name) ILIKE unaccent(:term)
          OR request.email ILIKE :term)`,
        { term: `%${escapeLike(search)}%` },
      );
    }
    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<UnitRaw>(),
      query.getCount(),
    ]);
    return paginate(
      entities.map((row, index) => this.toView(row, raw[index])),
      total,
      page,
    );
  }

  async findRequest(id: string): Promise<EnrollmentRequestView | null> {
    const { entities, raw } = await this.requestQuery()
      .where("request.idtb_enrollment_requests = :id", { id })
      .getRawAndEntities<UnitRaw>();
    const row = entities[0];
    return row ? this.toView(row, raw[0]) : null;
  }

  async findPending(input: {
    email: string;
    condominiumId: string;
  }): Promise<EnrollmentRequest | null> {
    const row = await this.requests.findOne({
      where: {
        status: EnrollmentStatus.PENDENTE,
        email: input.email,
        condominiumId: input.condominiumId,
      },
    });
    return row ? toRequest(row) : null;
  }

  countPending(condominiumId: string): Promise<number> {
    return this.requests.count({
      where: { status: EnrollmentStatus.PENDENTE, condominiumId },
    });
  }

  async createRequest(
    data: EnrollmentData & {
      condominiumId: string;
      inviteId: string;
      consentAt: Date;
      photoKey: string | null;
    },
    notices: (requestId: string) => OutboxDraft[],
  ): Promise<EnrollmentRequest> {
    const row = await this.requests.manager.transaction(async (manager) => {
      const repository = manager.getRepository(EnrollmentRequestOrmEntity);
      const saved = await repository.save(
        repository.create({ ...data, status: EnrollmentStatus.PENDENTE }),
      );
      await this.outbox.write(manager, notices(saved.id));
      return saved;
    });
    return toRequest(row);
  }

  async updateRequest(
    id: string,
    patch: Partial<EnrollmentData> & {
      status?: EnrollmentStatus;
      reviewedBy?: string;
      reviewedAt?: Date;
      rejectionReason?: string | null;
      userId?: string;
      photoKey?: string | null;
    },
  ): Promise<EnrollmentRequestView> {
    await this.requests.update({ id }, patch);
    const request = await this.findRequest(id);
    if (!request) throw new Error(`Enrollment request ${id} vanished`);
    return request;
  }
}
