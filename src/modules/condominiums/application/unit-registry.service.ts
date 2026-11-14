import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  UNIT_REPOSITORY,
  type UnitRepositoryPort,
} from "@/modules/condominiums/application/ports/unit-repository.port";
import {
  normalizeBlock,
  normalizeUnitNumber,
  unitKey,
  type Unit,
} from "@/modules/condominiums/domain/unit";

// For other modules (enrollment): the unit a manager approved by its block
// and number. An existing unit with the same name (ignoring case) is reused;
// otherwise it is created, so a condominium without units registered yet
// can still take sign-ups.
@Injectable()
export class UnitRegistryService {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async ensure(
    condominiumId: string,
    place: { block: string | null; number: string },
    actorId: string,
  ): Promise<Unit> {
    const block = normalizeBlock(place.block);
    const number = normalizeUnitNumber(place.number);
    if (block === null || !number) {
      throw AppException.from(APP_ERRORS.condominiums.unitInvalid, {
        reason: "Informe o bloco (até 30 caracteres) e o número da unidade.",
      });
    }
    const wanted = { block, number };
    const existing = (await this.units.list(condominiumId)).find(
      (unit) => unitKey(unit) === unitKey(wanted),
    );
    if (existing) return existing;

    const [created] = await this.units.createMany(condominiumId, [wanted]);
    if (!created) throw new Error("Unit not created");
    await this.audit.stamp({
      actorId,
      entity: "unit",
      entityId: created.id,
      created: true,
    });
    return created;
  }
}
