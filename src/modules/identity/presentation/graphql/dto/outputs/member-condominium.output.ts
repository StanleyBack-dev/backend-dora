import { Field, ID, ObjectType } from "@nestjs/graphql";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@ObjectType("MemberCondominium", {
  description: "Condomínio que a pessoa pode abrir (é membro ativo).",
})
export class MemberCondominiumType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field(() => UserGroup, { description: "Papel nele." })
  role!: UserGroup;
}
