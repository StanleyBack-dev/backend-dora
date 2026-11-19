import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import { UnitType } from "@/modules/condominiums/presentation/graphql/dto/outputs/unit.output";

@ObjectType("UnitResident", {
  description: "Alguém vinculado à unidade, como a página de unidades mostra.",
})
export class UnitResidentType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field(() => UserGroup, { description: "Papel no condomínio." })
  role!: UserGroup;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true, description: "Só dígitos." })
  phone!: string | null;

  @Field({ description: "Vínculo e conta ativos." })
  active!: boolean;
}

@ObjectType("UnitWithResidents", {
  description: "Unidade com as pessoas vinculadas a ela.",
})
export class UnitWithResidentsType extends UnitType {
  @Field(() => [UnitResidentType], {
    description: "Ativos primeiro, depois por nome.",
  })
  people!: UnitResidentType[];
}

export const UnitWithResidentsPage = Paginated(
  UnitWithResidentsType,
  "UnitWithResidentsPage",
);
