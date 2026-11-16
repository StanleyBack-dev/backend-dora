import type { PixReceiver } from "@/shared/domain/pix";

export interface CondominiumPixRepositoryPort {
  /** The condominium's PIX (null: none set yet). */
  find(condominiumId: string): Promise<PixReceiver | null>;
  /** Creates or replaces it. */
  save(
    condominiumId: string,
    receiver: PixReceiver,
    actorId: string,
  ): Promise<PixReceiver>;
  remove(condominiumId: string): Promise<void>;
}

export const CONDOMINIUM_PIX_REPOSITORY = Symbol("CONDOMINIUM_PIX_REPOSITORY");
