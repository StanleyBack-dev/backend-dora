import { Field, Float, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ORDER_LIMITS } from "@/modules/purchases/domain/purchase-order";
import { PURCHASE_REQUEST_LIMITS } from "@/modules/purchases/domain/purchase-request";

@InputType({ description: "O pedido de uma compra aprovada." })
export class PlacePurchaseOrderInput {
  @Field(() => String, {
    nullable: true,
    description: "Entrega prevista (AAAA-MM-DD).",
  })
  @IsOptional()
  @IsString()
  expectedOn?: string | null;

  @Field({
    description:
      "Vencimento da primeira parcela (ou do pagamento à vista); as demais, mês a mês.",
  })
  @IsString()
  firstDueOn!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ORDER_LIMITS.notes)
  notes?: string | null;
}

@InputType({ description: "O que chegou de um item." })
export class PurchaseReceiptItemInput {
  @Field(() => ID)
  @IsUUID()
  requestItemId!: string;

  @Field(() => Float)
  @Min(0)
  @Max(PURCHASE_REQUEST_LIMITS.maxQuantity)
  quantity!: number;
}

@InputType({ description: "Uma entrega do pedido (toda ou em parte)." })
export class PurchaseReceiptInput {
  @Field({ description: "O dia em que chegou (AAAA-MM-DD)." })
  @IsString()
  receivedOn!: string;

  @Field(() => [PurchaseReceiptItemInput])
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptItemInput)
  @ArrayMinSize(1)
  @ArrayMaxSize(PURCHASE_REQUEST_LIMITS.maxItems)
  items!: PurchaseReceiptItemInput[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ORDER_LIMITS.invoiceNumber)
  invoiceNumber?: string | null;

  @Field(() => Float, { nullable: true, description: "Em centavos." })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(ORDER_LIMITS.maxInvoiceCents)
  invoiceCents?: number | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  invoiceDate?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ORDER_LIMITS.receiptNote)
  note?: string | null;
}

@InputType({ description: "O pagamento de uma parcela." })
export class PurchasePaymentInput {
  @Field({ description: "O dia em que foi paga (AAAA-MM-DD)." })
  @IsString()
  paidOn!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(ORDER_LIMITS.paymentNote)
  note?: string | null;
}
