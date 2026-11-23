import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";

@ObjectType("QuoteBoardPick", {
  description: "Um fornecedor e o valor final da cotação dele.",
})
export class QuoteBoardPickType {
  @Field()
  supplierName!: string;

  @Field(() => Float, { description: "Valor final pago, em centavos." })
  totalCents!: number;
}

@ObjectType("QuoteBoardRow", {
  description: "Uma solicitação na página de cotações.",
})
export class QuoteBoardRowType {
  @Field(() => PurchaseRequestType)
  request!: PurchaseRequestType;

  @Field(() => Int)
  quoteCount!: number;

  @Field(() => Int, { description: "Cotações com preço para todos os itens." })
  completeCount!: number;

  @Field(() => QuoteBoardPickType, {
    nullable: true,
    description: "A cotação completa mais barata.",
  })
  cheapest!: QuoteBoardPickType | null;

  @Field(() => QuoteBoardPickType, {
    nullable: true,
    description: "A cotação escolhida.",
  })
  chosen!: QuoteBoardPickType | null;
}

export const QuoteBoardPage = Paginated(QuoteBoardRowType, "QuoteBoardPage");

@ObjectType("QuoteBoardOverview", {
  description: "As cotações em números (os cards da página).",
})
export class QuoteBoardOverviewType {
  @Field(() => Int, { description: "Aguardando a primeira cotação." })
  awaitingQuotes!: number;

  @Field(() => Int, { description: "Em cotação." })
  quoting!: number;

  @Field(() => Int, {
    description: "Em cotação com menos cotações que o recomendado.",
  })
  belowMinimum!: number;

  @Field(() => Int, {
    description: "Com cotação escolhida, aguardando aprovação.",
  })
  awaitingApproval!: number;
}
