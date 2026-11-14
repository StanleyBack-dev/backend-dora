import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { SpaceKind } from "@/modules/spaces/domain/space";
import { SpaceRulesType } from "@/modules/spaces/presentation/graphql/dto/outputs/space-rules.output";
import "@/modules/spaces/presentation/graphql/spaces.graphql-enums";

@ObjectType("Space", {
  description: "Espaço reservável do condomínio (quadra, salão…).",
})
export class SpaceType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => SpaceKind)
  kind!: SpaceKind;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int, { nullable: true, description: "Capacidade de pessoas." })
  capacity!: number | null;

  @Field(() => String, {
    nullable: true,
    description: "Regras de uso mostradas antes de reservar.",
  })
  usageRules!: string | null;

  @Field({ description: "Inativo: fora da lista dos moradores (manutenção)." })
  active!: boolean;

  @Field(() => SpaceRulesType)
  rules!: SpaceRulesType;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
