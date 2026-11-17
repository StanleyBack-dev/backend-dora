import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { PersonMembershipType } from "@/modules/platform-directory/presentation/graphql/dto/outputs/person-membership.output";

@ObjectType("PlatformPerson", {
  description: "Uma pessoa com conta no Dora (diretório da plataforma).",
})
export class PlatformPersonType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field({ description: "Administra a plataforma." })
  platformAdmin!: boolean;

  @Field({ description: "Conta ativa." })
  active!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: "Bloqueada por senhas erradas até este momento.",
  })
  lockedUntil!: Date | null;

  @Field(() => Date, { nullable: true })
  lastLoginAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => [PersonMembershipType])
  memberships!: PersonMembershipType[];
}

export const PlatformPersonPage = Paginated(
  PlatformPersonType,
  "PlatformPersonPage",
);
