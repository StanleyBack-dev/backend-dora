import type { SpaceBlock } from "@/modules/bookings/domain/space-block";

export type SpaceBlockView = SpaceBlock & { createdByName: string | null };

export interface SpaceBlockRepositoryPort {
  /** Blocks of a space that have not ended by `from`, soonest first. */
  upcoming(spaceId: string, from: Date): Promise<SpaceBlockView[]>;
  /** Blocks of a space that overlap [from, to). */
  overlapping(spaceId: string, from: Date, to: Date): Promise<SpaceBlock[]>;
  /** Only when it belongs to the condominium. */
  find(condominiumId: string, id: string): Promise<SpaceBlock | null>;
  create(
    data: Pick<
      SpaceBlock,
      "condominiumId" | "spaceId" | "startsAt" | "endsAt" | "reason"
    >,
  ): Promise<SpaceBlock>;
  delete(id: string): Promise<void>;
}

export const SPACE_BLOCK_REPOSITORY = Symbol("SPACE_BLOCK_REPOSITORY");
