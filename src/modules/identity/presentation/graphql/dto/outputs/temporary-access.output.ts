import { Field, ObjectType } from "@nestjs/graphql";
import { UserAccountType } from "@/modules/identity/presentation/graphql/dto/outputs/user-account.output";

@ObjectType("TemporaryAccess", {
  description: "Senha temporária, exibida uma única vez para quem a gerou.",
})
export class TemporaryAccessType {
  @Field(() => UserAccountType)
  user!: UserAccountType;

  @Field(() => String, {
    nullable: true,
    description: "Null quando a pessoa já tinha conta no Dora.",
  })
  temporaryPassword!: string | null;

  @Field({ description: "Se o e-mail com o acesso foi enviado." })
  emailSent!: boolean;

  @Field({
    description:
      "A pessoa já tinha conta no Dora: só ganhou acesso a este condomínio.",
  })
  existingAccount!: boolean;
}
