import { Field, ID, ObjectType } from "@nestjs/graphql";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import "@/modules/identity/presentation/graphql/identity.graphql-enums";

@ObjectType("CondominiumMember", {
  description: "Uma pessoa de um condomínio, vista pela plataforma.",
})
export class CondominiumMemberType {
  @Field(() => ID)
  userId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => UserGroup, { description: "Papel no condomínio." })
  role!: UserGroup;

  @Field(() => MemberKind)
  kind!: MemberKind;

  @Field({ description: "Acesso ativo ao condomínio." })
  active!: boolean;

  @Field(() => String, { nullable: true, description: "Moradores." })
  unitLabel!: string | null;

  @Field(() => String, { nullable: true, description: "Funcionários." })
  jobTitle!: string | null;

  @Field(() => Date, { nullable: true })
  lastLoginAt!: Date | null;

  @Field(() => Date, { description: "Desde quando tem acesso." })
  since!: Date;
}
