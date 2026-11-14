import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("InactiveCondominium", {
  description: "Condomínio sem acessos há 30 dias.",
})
export class InactiveCondominiumType {
  @Field(() => ID)
  condominiumId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Date, {
    nullable: true,
    description: "Último acesso de um membro (null: nunca).",
  })
  lastActivityAt!: Date | null;
}
