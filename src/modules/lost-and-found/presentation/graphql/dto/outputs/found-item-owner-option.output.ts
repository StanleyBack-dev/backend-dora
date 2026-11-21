import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType({
  description: "Um morador (com a unidade) para indicar de quem é um item.",
})
export class FoundItemOwnerOptionType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field(() => ID)
  unitId!: string;

  @Field({ description: "Ex.: Bloco A · 101." })
  unitLabel!: string;
}
