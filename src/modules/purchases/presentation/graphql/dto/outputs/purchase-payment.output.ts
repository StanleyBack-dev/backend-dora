import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";

@ObjectType("PaymentBoardRow", {
  description: "Uma parcela a pagar (ou paga), com a compra dela.",
})
export class PaymentBoardRowType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  number!: number;

  @Field(() => Int, { description: "Quantas parcelas o pedido tem." })
  installmentCount!: number;

  @Field(() => Float, { description: "Em centavos." })
  amountCents!: number;

  @Field()
  dueOn!: string;

  @Field(() => String, { nullable: true })
  paidOn!: string | null;

  @Field(() => String, { nullable: true })
  paidByName!: string | null;

  @Field(() => String, { nullable: true })
  proofUrl!: string | null;

  @Field(() => Boolean, { nullable: true })
  proofIsPdf!: boolean | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => ID)
  requestId!: string;

  @Field(() => Int)
  requestNumber!: number;

  @Field()
  requestTitle!: string;

  @Field(() => Int)
  orderNumber!: number;

  @Field()
  orderedAt!: Date;

  @Field()
  supplierName!: string;
}

export const PaymentBoardPage = Paginated(
  PaymentBoardRowType,
  "PaymentBoardPage",
);

@ObjectType("PaymentBoardOverview", {
  description: "As contas a pagar em números (os cards da página).",
})
export class PaymentBoardOverviewType {
  @Field(() => Float)
  openCents!: number;

  @Field(() => Int)
  openCount!: number;

  @Field(() => Float)
  overdueCents!: number;

  @Field(() => Int)
  overdueCount!: number;

  @Field(() => Float, { description: "Vencem em até 7 dias." })
  dueSoonCents!: number;

  @Field(() => Int)
  dueSoonCount!: number;

  @Field(() => Float)
  paidThisMonthCents!: number;

  @Field(() => Int)
  paidThisMonthCount!: number;
}
