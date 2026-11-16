import { Inject, Injectable } from "@nestjs/common";
import {
  CONDOMINIUM_PIX_REPOSITORY,
  type CondominiumPixRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-pix-repository.port";
import type { PixReceiver } from "@/shared/domain/pix";

// Read-only access to a condominium's PIX for other modules (events charge
// with it unless an event has its own).
@Injectable()
export class CondominiumPixLookupService {
  constructor(
    @Inject(CONDOMINIUM_PIX_REPOSITORY)
    private readonly pix: CondominiumPixRepositoryPort,
  ) {}

  find(condominiumId: string): Promise<PixReceiver | null> {
    return this.pix.find(condominiumId);
  }
}
