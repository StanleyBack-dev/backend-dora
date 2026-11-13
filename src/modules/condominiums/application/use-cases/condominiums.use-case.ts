import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  CONDOMINIUM_REPOSITORY,
  type CondominiumFilter,
  type CondominiumRepositoryPort,
  type CondominiumSummary,
} from "@/modules/condominiums/application/ports/condominium-repository.port";
import {
  normalizeCondominium,
  type CondominiumDraft,
  type CondominiumStatus,
  type CondominiumViolation,
} from "@/modules/condominiums/domain/condominium";

export const CONDOMINIUM_VIOLATIONS: Record<CondominiumViolation, string> = {
  name: "O nome deve ter de 2 a 120 caracteres.",
  document: "CNPJ inválido.",
  city: "A cidade deve ter de 2 a 80 caracteres.",
  state: "Escolha o estado (UF).",
};

@Injectable()
export class CondominiumsUseCase {
  constructor(
    @Inject(CONDOMINIUM_REPOSITORY)
    private readonly condominiums: CondominiumRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(filter: CondominiumFilter): Promise<CondominiumSummary[]> {
    return this.condominiums.list(filter);
  }

  async get(id: string): Promise<CondominiumSummary> {
    const found = await this.condominiums.findSummary(id);
    if (!found) {
      throw AppException.from(APP_ERRORS.condominiums.notFound, undefined);
    }
    return found;
  }

  async create(
    actor: AuthenticatedUser,
    draft: CondominiumDraft,
  ): Promise<CondominiumSummary> {
    const data = this.validate(draft);
    await this.assertFreeDocument(data.document);
    const created = await this.condominiums.create(data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "condominium",
      entityId: created.id,
      created: true,
    });
    return this.get(created.id);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    draft: CondominiumDraft,
  ): Promise<CondominiumSummary> {
    await this.get(id);
    const data = this.validate(draft);
    await this.assertFreeDocument(data.document, id);
    await this.condominiums.update(id, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "condominium",
      entityId: id,
    });
    return this.get(id);
  }

  /** Suspending keeps the data; members just can't work in it. */
  async setStatus(
    actor: AuthenticatedUser,
    id: string,
    status: CondominiumStatus,
  ): Promise<CondominiumSummary> {
    const current = await this.get(id);
    if (current.status === status) return current;
    await this.condominiums.update(id, { status });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "condominium",
      entityId: id,
    });
    return this.get(id);
  }

  private validate(draft: CondominiumDraft): Required<CondominiumDraft> {
    const data = normalizeCondominium(draft);
    if (typeof data === "string") {
      throw AppException.from(APP_ERRORS.condominiums.invalid, {
        reason: CONDOMINIUM_VIOLATIONS[data],
      });
    }
    return data;
  }

  private async assertFreeDocument(
    document: string | null,
    exceptId?: string,
  ): Promise<void> {
    if (!document) return;
    const owner = await this.condominiums.findByDocument(document);
    if (owner && owner.id !== exceptId) {
      throw AppException.from(APP_ERRORS.condominiums.documentTaken, undefined);
    }
  }
}
