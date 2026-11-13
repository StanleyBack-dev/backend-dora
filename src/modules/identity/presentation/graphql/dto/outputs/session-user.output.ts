import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

@ObjectType("SessionUser", { description: "Usuário da sessão atual." })
export class SessionUserType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  username!: string;

  @Field()
  email!: string;

  @Field(() => UserGroup, {
    description:
      "Grupo no contexto atual: papel no condomínio, ou ADMIN_MASTER (plataforma).",
  })
  group!: UserGroup;

  @Field({ description: "Administra a plataforma (todos os condomínios)." })
  platformAdmin!: boolean;

  @Field({
    description: "Precisa trocar a senha temporária antes de usar o app.",
  })
  mustChangePassword!: boolean;

  @Field(() => [Permission], {
    description: "Permissões efetivas no condomínio atual.",
  })
  permissions!: Permission[];

  /** Resolved by the `condominium` field (not exposed as such). */
  condominiumId!: string | null;
}
