import { Field, ID, ObjectType } from "@nestjs/graphql";
import {
  ClaimStatus,
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@ObjectType("FoundItemClaim", {
  description: "Pedido de um morador dizendo que o item é dele.",
})
export class FoundItemClaimType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  itemId!: string;

  @Field()
  itemTitle!: string;

  @Field(() => FoundItemStatus)
  itemStatus!: FoundItemStatus;

  @Field(() => FoundItemCategory)
  itemCategory!: FoundItemCategory;

  @Field(() => ID)
  userId!: string;

  @Field()
  userName!: string;

  @Field(() => String, { nullable: true, description: "Unidade do morador." })
  unitLabel!: string | null;

  @Field({ description: "Como o morador descreveu o item." })
  message!: string;

  @Field(() => ClaimStatus)
  status!: ClaimStatus;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  decidedAt!: Date | null;

  @Field(() => String, { nullable: true })
  decidedByName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Observação da portaria (o motivo, ao recusar).",
  })
  decisionNote!: string | null;
}
