import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { PaymentMethod } from "@/modules/purchases/domain/purchase-quote";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("PurchaseQuoteLine", {
  description: "O preço de um item numa cotação (na ordem dos itens).",
})
export class PurchaseQuoteLineType {
  @Field(() => ID)
  requestItemId!: string;

  @Field(() => Float, {
    nullable: true,
    description: "Preço unitário em centavos (vazio: não cotou).",
  })
  unitPriceCents!: number | null;

  @Field(() => Float, {
    nullable: true,
    description: "Quantidade × preço, em centavos.",
  })
  lineCents!: number | null;
}

@ObjectType("QuoteCharge", {
  description: "Um dos outros encargos de uma cotação.",
})
export class QuoteChargeType {
  @Field()
  label!: string;

  @Field(() => Float, { description: "Valor em centavos." })
  amountCents!: number;
}

@ObjectType("PurchaseQuote", {
  description: "Cotação de um fornecedor para uma solicitação de compra.",
})
export class PurchaseQuoteType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  supplierId!: string;

  @Field()
  supplierName!: string;

  @Field(() => [PurchaseQuoteLineType])
  lines!: PurchaseQuoteLineType[];

  @Field(() => Float, { description: "Frete em centavos." })
  shippingCents!: number;

  @Field(() => [QuoteChargeType])
  charges!: QuoteChargeType[];

  @Field(() => Float, { description: "A soma dos encargos, em centavos." })
  chargesCents!: number;

  @Field(() => Float, { description: "Desconto, em centavos." })
  discountCents!: number;

  @Field(() => Int, {
    nullable: true,
    description: "Desconto em centésimos de % (vazio: valor fixo).",
  })
  discountPercentBp!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: "Juros ao mês, em centésimos de % (vazio: sem juros).",
  })
  interestRateBp!: number | null;

  @Field(() => Float, { description: "Itens cotados, em centavos." })
  itemsCents!: number;

  @Field(() => Float, {
    description: "Itens + frete + encargos − desconto (à vista), em centavos.",
  })
  cashCents!: number;

  @Field(() => Float, {
    description:
      "O valor final pago (com juros, a soma das parcelas), em centavos.",
  })
  totalCents!: number;

  @Field(() => Float, { description: "Juros do parcelamento, em centavos." })
  interestCents!: number;

  @Field(() => [Float], {
    description: "O valor de cada parcela (vazio: à vista).",
  })
  installmentValues!: number[];

  @Field({ description: "Todos os itens têm preço." })
  complete!: boolean;

  @Field({ description: "A cotação completa mais barata (empates também)." })
  cheapest!: boolean;

  @Field({ description: "A escolhida pela gestão." })
  chosen!: boolean;

  @Field(() => Int, { nullable: true })
  deliveryDays!: number | null;

  @Field(() => PaymentMethod, { nullable: true })
  paymentMethod!: PaymentMethod | null;

  @Field(() => Int, {
    nullable: true,
    description: "Parcelas (vazio: à vista).",
  })
  installments!: number | null;

  @Field(() => String, {
    nullable: true,
    description: "Com OTHER: a forma de pagamento digitada.",
  })
  paymentTerms!: string | null;

  @Field(() => String, { nullable: true })
  validUntil!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Link temporário do orçamento do fornecedor.",
  })
  fileUrl!: string | null;

  @Field(() => Boolean, { nullable: true })
  fileIsPdf!: boolean | null;

  @Field()
  createdAt!: Date;
}
