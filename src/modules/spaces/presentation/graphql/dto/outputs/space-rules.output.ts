import { Field, Int, ObjectType } from "@nestjs/graphql";
import { GuestRulesType } from "@/modules/spaces/presentation/graphql/dto/outputs/guest-rules.output";
import { OpeningHoursType } from "@/modules/spaces/presentation/graphql/dto/outputs/opening-hours.output";
import { UnitLimitType } from "@/modules/spaces/presentation/graphql/dto/outputs/unit-limit.output";

@ObjectType("SpaceRules", { description: "Regras de reserva do espaço." })
export class SpaceRulesType {
  @Field(() => [OpeningHoursType])
  openingHours!: OpeningHoursType[];

  @Field(() => Int, { description: "Duração de cada reserva, em minutos." })
  slotMinutes!: number;

  @Field(() => Int, { description: "Antecedência mínima, em horas." })
  minAdvanceHours!: number;

  @Field(() => Int, { description: "A agenda abre até tantos dias à frente." })
  maxAdvanceDays!: number;

  @Field(() => UnitLimitType, {
    nullable: true,
    description: "Limite por unidade (null: sem limite).",
  })
  unitLimit!: UnitLimitType | null;

  @Field({ description: "As reservas aguardam a aprovação de um gestor." })
  requiresApproval!: boolean;

  @Field(() => Int, {
    description: "Cancelamento permitido até tantas horas antes do início.",
  })
  cancelUntilHours!: number;

  @Field(() => Int, {
    nullable: true,
    description: "Taxa de uso por reserva, em centavos (null: gratuito).",
  })
  feeCents!: number | null;

  @Field(() => GuestRulesType)
  guests!: GuestRulesType;

  @Field({
    description: "Moradores podem reservar toda semana no mesmo horário.",
  })
  recurringAllowed!: boolean;
}
