import { Inject, Injectable } from "@nestjs/common";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { FoundItem } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { returnDeclaration } from "@/modules/lost-and-found/domain/found-item";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatLocalDate, toLocalDate } from "@/shared/domain/local-date";

// The declaration shown before signing a return, and checked again when the
// signature arrives (the signer's name goes in front of it).
@Injectable()
export class LostFoundDeclarationService {
  constructor(
    private readonly condominiums: CondominiumLookupService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async forItem(
    item: Pick<
      FoundItem,
      "condominiumId" | "title" | "category" | "foundLocation" | "foundAt"
    >,
  ): Promise<string> {
    const condominium = await this.condominiums.find(item.condominiumId);
    return returnDeclaration({
      condominiumName: condominium?.name ?? "condomínio",
      title: item.title,
      category: item.category,
      foundLocation: item.foundLocation,
      foundOn: formatLocalDate(toLocalDate(item.foundAt, this.clock.timeZone)),
    });
  }
}
