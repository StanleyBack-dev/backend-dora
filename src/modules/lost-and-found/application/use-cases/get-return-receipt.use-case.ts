import { Inject, Injectable } from "@nestjs/common";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItemRepositoryPort,
  type FoundItemReturn,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  canonicalJson,
  sha256,
} from "@/shared/domain/signature/signature-capture";

export type CheckedReturn = FoundItemReturn & {
  /**
   * The record is intact: the evidence stored still gives the digest
   * written at signing, and the drawing still gives its own digest.
   */
  intact: boolean;
  /** Handed over by its own claimant, the team's only member then. */
  selfHandover: boolean;
};

// The return receipt: the signature with its evidence, and whether the
// record is intact. The caller already checked who may see the item.
@Injectable()
export class GetReturnReceiptUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
  ) {}

  async execute(itemId: string): Promise<CheckedReturn | null> {
    const record = await this.items.findReturn(itemId);
    if (!record) return null;
    const evidence = record.evidence as Record<string, unknown> | null;
    const intact =
      sha256(canonicalJson(record.evidence)) === record.evidenceSha256 &&
      sha256(canonicalJson(record.drawing)) === evidence?.strokesSha256 &&
      evidence?.imageSha256 === record.imageSha256;
    return { ...record, intact, selfHandover: evidence?.selfHandover === true };
  }
}
