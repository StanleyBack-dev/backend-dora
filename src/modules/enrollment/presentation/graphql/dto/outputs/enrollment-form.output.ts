import { Field, ObjectType } from "@nestjs/graphql";
import { AddressFormat } from "@/modules/condominiums/domain/condominium";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";
import { EnrollmentUnitOptionType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-unit-option.output";

@ObjectType("EnrollmentForm", {
  description: "O que o formulário público mostra depois do código.",
})
export class EnrollmentFormType {
  @Field()
  condominiumName!: string;

  @Field(() => AddressFormat, {
    description:
      "Casas: a pessoa digita rua, quadra e lote (sem lista de unidades).",
  })
  addressFormat!: AddressFormat;

  @Field(() => [EnrollmentUnitOptionType], {
    description: "Unidades para escolher (vazio: o condomínio não tem).",
  })
  units!: EnrollmentUnitOptionType[];
}
