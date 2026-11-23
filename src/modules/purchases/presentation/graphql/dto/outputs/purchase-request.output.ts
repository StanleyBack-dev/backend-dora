import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { Category } from "@/modules/catalog/domain/category";
import {
  PurchasePriority,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import { PurchaseRequestItemType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request-item.output";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("PurchaseRequest", {
  description: "Solicitação de compra (o que a equipe precisa comprar).",
})
export class PurchaseRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, {
    description: "Número no condomínio (exibido como SC-0001).",
  })
  number!: number;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => [Category])
  categories!: Category[];

  @Field(() => String, {
    nullable: true,
    description: "Com OTHER entre as categorias: de que é a compra, digitado.",
  })
  categoryOther!: string | null;

  @Field(() => PurchasePriority)
  priority!: PurchasePriority;

  @Field(() => ID, {
    nullable: true,
    description: "O espaço do condomínio onde vai ser usado.",
  })
  spaceId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Onde vai ser usado: o nome do espaço ou o local digitado.",
  })
  location!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Dia em que precisa (AAAA-MM-DD).",
  })
  neededBy!: string | null;

  @Field(() => PurchaseRequestStatus)
  status!: PurchaseRequestStatus;

  @Field(() => ID)
  requestedById!: string;

  @Field()
  requestedByName!: string;

  @Field(() => [PurchaseRequestItemType])
  items!: PurchaseRequestItemType[];

  @Field(() => Int, { description: "Quantas cotações tem." })
  quoteCount!: number;

  @Field(() => ID, {
    nullable: true,
    description: "A cotação escolhida pela gestão.",
  })
  chosenQuoteId!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Por que essa (obrigatório quando não é a mais barata ou há menos de 3 cotações).",
  })
  choiceJustification!: string | null;

  @Field(() => Date, { nullable: true })
  chosenAt!: Date | null;

  @Field(() => String, { nullable: true })
  cancelReason!: string | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
