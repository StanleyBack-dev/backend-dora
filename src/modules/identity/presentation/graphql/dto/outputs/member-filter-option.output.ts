import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("MemberFilterOption", {
  description:
    "Um membro como os filtros da lista o oferecem (nome, e-mail, telefone).",
})
export class MemberFilterOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true, description: "Só dígitos." })
  phone!: string | null;
}
