import { Field, ObjectType } from "@nestjs/graphql";
import { EnrollmentUnitOptionType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-unit-option.output";

@ObjectType("EnrollmentForm", {
  description: "O que o formulário público mostra depois do código.",
})
export class EnrollmentFormType {
  @Field()
  condominiumName!: string;

  @Field(() => [EnrollmentUnitOptionType], {
    description: "Unidades para escolher (vazio: o condomínio não tem).",
  })
  units!: EnrollmentUnitOptionType[];
}
