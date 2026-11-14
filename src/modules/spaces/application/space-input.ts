import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { SpaceData } from "@/modules/spaces/application/ports/space-repository.port";
import {
  normalizeSpaceDetails,
  type SpaceDetailsViolation,
} from "@/modules/spaces/domain/space";
import {
  normalizeSpaceRules,
  type SpaceRulesViolation,
} from "@/modules/spaces/domain/space-rules";

const MESSAGES: Record<SpaceDetailsViolation | SpaceRulesViolation, string> = {
  name: "O nome deve ter de 2 a 80 caracteres.",
  description: "A descrição deve ter até 1000 caracteres.",
  capacity: "A capacidade deve ser um número de 1 a 5000.",
  "usage-rules": "As regras de uso devem ter até 3000 caracteres.",
  "opening-hours":
    "Confira os horários: cada dia aparece uma vez e abre antes de fechar.",
  "opening-hours-slot":
    "Cada dia aberto precisa caber ao menos um horário de reserva.",
  slot: "A duração da reserva vai de 15 minutos a 24 horas, de 15 em 15 minutos.",
  "min-advance": "A antecedência mínima vai de 0 a 720 horas.",
  "max-advance":
    "A agenda abre de 1 a 365 dias à frente, e depois da antecedência mínima.",
  "unit-limit": "O limite por unidade vai de 1 a 100 reservas por período.",
  cancel: "O prazo para cancelar vai de 0 a 720 horas antes do início.",
};

/** Validates and normalizes a space's form (details and booking rules). */
export function validateSpaceInput(input: SpaceData): SpaceData {
  const details = normalizeSpaceDetails(input);
  if (typeof details === "string") {
    throw AppException.from(APP_ERRORS.spaces.invalid, {
      reason: MESSAGES[details],
    });
  }
  const rules = normalizeSpaceRules(input.rules);
  if (typeof rules === "string") {
    throw AppException.from(APP_ERRORS.spaces.invalid, {
      reason: MESSAGES[rules],
    });
  }
  return { ...details, rules };
}
