import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("ParcelRecipient", {
  description: "Um morador (com a unidade) para registrar uma encomenda.",
})
export class ParcelRecipientType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field(() => ID)
  unitId!: string;

  @Field({ description: "Ex.: Bloco A · 101." })
  unitLabel!: string;
}
