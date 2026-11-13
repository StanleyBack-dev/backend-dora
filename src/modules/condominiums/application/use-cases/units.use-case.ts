import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  UNIT_REPOSITORY,
  type UnitRepositoryPort,
  type UnitView,
} from "@/modules/condominiums/application/ports/unit-repository.port";
import {
  expandUnitNumbers,
  normalizeBlock,
  normalizeUnitNumber,
  unitKey,
  unitLabel,
  type Unit,
  type UnitNumbersError,
} from "@/modules/condominiums/domain/unit";

export const UNIT_NUMBER_ERRORS: Record<UnitNumbersError, string> = {
  empty: "Informe ao menos um número de unidade.",
  invalid:
    "Números inválidos. Use vírgulas e faixas, por exemplo: 101-104, 201.",
  "too-many": "No máximo 500 unidades por vez.",
};

@Injectable()
export class UnitsUseCase {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  list(condominiumId: string): Promise<UnitView[]> {
    return this.units.list(condominiumId);
  }

  /** One block, many numbers ("101-104, 201"). All are created or none. */
  async create(
    actor: AuthenticatedUser,
    condominiumId: string,
    input: { block?: string | null; numbers: string },
  ): Promise<UnitView[]> {
    const block = this.block(input.block);
    const numbers = expandUnitNumbers(input.numbers);
    if (typeof numbers === "string") {
      throw AppException.from(APP_ERRORS.condominiums.unitInvalid, {
        reason: UNIT_NUMBER_ERRORS[numbers],
      });
    }

    // Keyed case-insensitively; the message shows the units as stored.
    const existing = new Map(
      (await this.units.list(condominiumId)).map((unit) => [
        unitKey(unit),
        unit,
      ]),
    );
    const wanted = numbers.map((number) => ({ block, number }));
    const taken = wanted.flatMap((unit) => existing.get(unitKey(unit)) ?? []);
    if (taken.length > 0) {
      throw AppException.from(APP_ERRORS.condominiums.unitTaken, {
        labels: this.labels(taken),
      });
    }

    const created = await this.units.createMany(condominiumId, wanted);
    await this.audit.stampMany({
      actorId: actor.id,
      entity: "unit",
      entityIds: created.map((unit) => unit.id),
      created: true,
    });
    return created.map((unit) => ({ ...unit, residents: 0 }));
  }

  async update(
    actor: AuthenticatedUser,
    condominiumId: string,
    id: string,
    input: { block?: string | null; number: string },
  ): Promise<UnitView> {
    const unit = await this.find(condominiumId, id);
    const block = this.block(input.block);
    const number = normalizeUnitNumber(input.number);
    if (!number) {
      throw AppException.from(APP_ERRORS.condominiums.unitInvalid, {
        reason: "O número deve ter de 1 a 20 caracteres.",
      });
    }
    const next = { block, number };
    const clash = (await this.units.list(condominiumId)).find(
      (other) => other.id !== id && unitKey(other) === unitKey(next),
    );
    if (clash) {
      throw AppException.from(APP_ERRORS.condominiums.unitTaken, {
        labels: unitLabel(next),
      });
    }
    await this.units.update(id, next);
    await this.audit.stamp({ actorId: actor.id, entity: "unit", entityId: id });
    return { ...unit, ...next };
  }

  /** Only a unit nobody is linked to (moving residents is a choice). */
  async remove(condominiumId: string, id: string): Promise<boolean> {
    const unit = await this.find(condominiumId, id);
    if (unit.residents > 0) {
      throw AppException.from(APP_ERRORS.condominiums.unitInUse, undefined);
    }
    await this.units.delete(id);
    return true;
  }

  private async find(condominiumId: string, id: string): Promise<UnitView> {
    const unit = await this.units.findById(condominiumId, id);
    if (!unit) {
      throw AppException.from(APP_ERRORS.condominiums.unitNotFound, undefined);
    }
    return unit;
  }

  private block(value: string | null | undefined): string {
    const block = normalizeBlock(value);
    if (block === null) {
      throw AppException.from(APP_ERRORS.condominiums.unitInvalid, {
        reason: "O bloco deve ter até 30 caracteres.",
      });
    }
    return block;
  }

  private labels(units: Pick<Unit, "block" | "number">[]): string {
    const shown = units.slice(0, 5).map(unitLabel).join(", ");
    return units.length > 5 ? `${shown} e mais ${units.length - 5}` : shown;
  }
}
