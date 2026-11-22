import { Field, Float, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseRequestItem", {
  description: "Um item de uma solicitação de compra.",
})
export class PurchaseRequestItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field()
  productName!: string;

  @Field(() => Float)
  quantity!: number;

  @Field()
  unit!: string;

  @Field(() => ID, {
    nullable: true,
    description: "A marca pedida (vazio: qualquer marca).",
  })
  brandId!: string | null;

  @Field(() => String, { nullable: true })
  brandName!: string | null;

  @Field(() => String, { nullable: true })
  note!: string | null;
}
