import { Field, ID, ObjectType } from "@nestjs/graphql";
import { DependentRelationship } from "@/modules/dependents/domain/dependent";
import "@/modules/dependents/presentation/graphql/dependents.graphql-enums";

@ObjectType("ResidentDependent", {
  description: "Dependente aprovado de um morador.",
})
export class ResidentDependentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => DependentRelationship)
  relationship!: DependentRelationship;
}

@ObjectType("ResidentListing", {
  description:
    "Morador na consulta da portaria: nome, foto, unidade, telefone e dependentes aprovados (sem e-mail, documentos ou nascimento).",
})
export class ResidentListingType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: "Link temporário da foto de perfil.",
  })
  photoUrl!: string | null;

  @Field(() => ID, { nullable: true })
  unitId!: string | null;

  @Field(() => String, { nullable: true, description: "Ex.: Bloco A · 101." })
  unitLabel!: string | null;

  @Field(() => String, { nullable: true, description: "Complemento." })
  unitComplement!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Telefone para contato (só dígitos).",
  })
  phone!: string | null;

  @Field(() => [ResidentDependentType])
  dependents!: ResidentDependentType[];
}
