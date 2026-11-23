import { Field, Float, ID, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  PaymentMethod,
  QUOTE_LIMITS as LIMITS,
} from "@/modules/purchases/domain/purchase-quote";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@InputType({ description: "O preço de um item da solicitação numa cotação." })
export class PurchaseQuoteItemInput {
  @Field(() => ID)
  @IsUUID()
  requestItemId!: string;

  @Field(() => Float, {
    nullable: true,
    description: "Preço unitário em centavos (vazio: o fornecedor não tem).",
  })
  @IsOptional()
  @IsNumber()
  unitPriceCents?: number | null;
}

@InputType({ description: "Um dos outros encargos de uma cotação." })
export class QuoteChargeInput {
  @Field({ description: "O que é (instalação, taxa…)." })
  @IsString()
  @MaxLength(LIMITS.chargeLabel + 20)
  label!: string;

  @Field(() => Float, { description: "Valor em centavos." })
  @IsNumber()
  amountCents!: number;
}

/**
 * Lengths here only stop abuse; the use case checks each value against the
 * request items.
 */
@InputType({ description: "Preços e condições de uma cotação." })
export class PurchaseQuoteInput {
  @Field(() => [PurchaseQuoteItemInput])
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PurchaseQuoteItemInput)
  items!: PurchaseQuoteItemInput[];

  @Field(() => Float, { nullable: true, description: "Frete em centavos." })
  @IsOptional()
  @IsNumber()
  shippingCents?: number | null;

  @Field(() => [QuoteChargeInput], {
    nullable: true,
    description: "Outros encargos (instalação, taxas…), cada um com o valor.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITS.maxCharges)
  @ValidateNested({ each: true })
  @Type(() => QuoteChargeInput)
  charges?: QuoteChargeInput[] | null;

  @Field(() => Float, {
    nullable: true,
    description: "Desconto fixo, em centavos (ignorado com porcentagem).",
  })
  @IsOptional()
  @IsNumber()
  discountCents?: number | null;

  @Field(() => Int, {
    nullable: true,
    description:
      "Desconto em porcentagem de itens + frete + encargos, em centésimos de % (5% = 500; até 10000).",
  })
  @IsOptional()
  @IsInt()
  discountPercentBp?: number | null;

  @Field(() => Int, {
    nullable: true,
    description:
      "Juros do parcelamento ao mês, em centésimos de % (1,99% = 199; até 2000). Só parcelado.",
  })
  @IsOptional()
  @IsInt()
  interestRateBp?: number | null;

  @Field(() => Int, {
    nullable: true,
    description: "Prazo de entrega em dias.",
  })
  @IsOptional()
  @IsInt()
  deliveryDays?: number | null;

  @Field(() => PaymentMethod, { nullable: true })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;

  @Field(() => Int, {
    nullable: true,
    description:
      "Parcelas (2 a 60; vazio ou 1: à vista). Cartão de crédito, boleto, faturado ou outro.",
  })
  @IsOptional()
  @IsInt()
  installments?: number | null;

  @Field(() => String, {
    nullable: true,
    description: "Com OTHER: a forma de pagamento digitada.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.paymentTerms + 20)
  paymentTerms?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Último dia em que os preços valem (AAAA-MM-DD).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  validUntil?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.notes + 20)
  notes?: string | null;
}
