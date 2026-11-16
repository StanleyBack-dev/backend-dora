import { Field, ID, ObjectType } from "@nestjs/graphql";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import { EmployeeProfileType } from "@/modules/identity/presentation/graphql/dto/outputs/employee-profile.output";
import "@/modules/identity/presentation/graphql/identity.graphql-enums";

@ObjectType("UserAccount", { description: "Usuário visto pela administração." })
export class UserAccountType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field(() => UserGroup, { description: "Papel no condomínio atual." })
  group!: UserGroup;

  @Field({ description: "Acesso ativo neste condomínio." })
  active!: boolean;

  @Field(() => MemberKind, { description: "Morador ou funcionário." })
  kind!: MemberKind;

  @Field(() => ID, { nullable: true })
  unitId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Unidade: "Bloco A · 101".',
  })
  unitLabel!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Complemento do endereço no condomínio ("casa dos fundos").',
  })
  unitComplement!: string | null;

  @Field(() => EmployeeProfileType, {
    nullable: true,
    description: "Ficha do funcionário (só funcionários).",
  })
  employee!: EmployeeProfileType | null;

  @Field(() => String, {
    nullable: true,
    description: "Telefone de contato (só dígitos: DDD + número).",
  })
  phone!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Data de nascimento (AAAA-MM-DD).",
  })
  birthDate!: string | null;

  /** Resolved into a signed link by the `photoUrl` field. */
  avatarKey!: string | null;

  @Field({
    description:
      "A conta também é usada fora deste condomínio: os dados de login só mudam pela própria pessoa ou pela plataforma.",
  })
  sharedAccount!: boolean;

  @Field({ description: "Ainda não trocou a senha temporária." })
  mustChangePassword!: boolean;

  @Field(() => Date, {
    nullable: true,
    description: "Bloqueado por tentativas inválidas até esta data.",
  })
  lockedUntil!: Date | null;

  @Field(() => Date, { nullable: true })
  lastLoginAt!: Date | null;

  @Field(() => Date, { nullable: true })
  deactivatedAt!: Date | null;

  @Field()
  createdAt!: Date;
}
