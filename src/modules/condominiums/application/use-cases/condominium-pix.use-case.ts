import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  CONDOMINIUM_PIX_REPOSITORY,
  type CondominiumPixRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-pix-repository.port";
import {
  normalizePixReceiver,
  PIX_VIOLATION_MESSAGES,
  type PixReceiver,
} from "@/shared/domain/pix";

// The managers keep the condominium's PIX (key, receiver name and city as
// the bank shows them): ticketed events charge with it.
@Injectable()
export class CondominiumPixUseCase {
  constructor(
    @Inject(CONDOMINIUM_PIX_REPOSITORY)
    private readonly pix: CondominiumPixRepositoryPort,
  ) {}

  get(actor: AuthenticatedUser): Promise<PixReceiver | null> {
    return this.pix.find(tenantOf(actor));
  }

  set(actor: AuthenticatedUser, input: PixReceiver): Promise<PixReceiver> {
    const receiver = normalizePixReceiver(input);
    if (typeof receiver === "string") {
      throw AppException.from(APP_ERRORS.condominiums.invalidPix, {
        reason: PIX_VIOLATION_MESSAGES[receiver],
      });
    }
    return this.pix.save(tenantOf(actor), receiver, actor.id);
  }

  async remove(actor: AuthenticatedUser): Promise<boolean> {
    await this.pix.remove(tenantOf(actor));
    return true;
  }
}
