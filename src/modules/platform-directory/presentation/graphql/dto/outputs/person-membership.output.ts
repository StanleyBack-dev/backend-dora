import { Field, ID, ObjectType } from "@nestjs/graphql";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import "@/modules/identity/presentation/graphql/identity.graphql-enums";

@ObjectType("PersonMembership", {
  description: "O acesso de uma pessoa a um condomínio.",
})
export class PersonMembershipType {
  @Field(() => ID)
  condominiumId!: string;

  @Field(() => String)
  condominiumName!: string;

  @Field(() => UserGroup, { description: "Papel no condomínio." })
  role!: UserGroup;

  @Field(() => MemberKind)
  kind!: MemberKind;

  @Field({ description: "Acesso ativo." })
  active!: boolean;
}
