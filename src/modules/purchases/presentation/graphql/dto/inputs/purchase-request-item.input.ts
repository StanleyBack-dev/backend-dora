import { Field, Float, ID, InputType } from "@nestjs/graphql";
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PURCHASE_REQUEST_LIMITS } from "@/modules/purchases/domain/purchase-request";

/** Lengths here only stop abuse; the use case checks and normalizes it. */
@InputType({ description: "Um item de uma solicitação de compra." })
export class PurchaseRequestItemInput {
  @Field(() => ID, { description: "Um produto do catálogo do condomínio." })
  @IsUUID()
  productId!: string;

  @Field(() => Float, { description: "Maior que zero, até 2 casas decimais." })
  @IsNumber()
  quantity!: number;

  @Field({ description: "un, cx, kg, m², serviço…" })
  @IsString()
  @MaxLength(PURCHASE_REQUEST_LIMITS.unit + 20)
  unit!: string;

  @Field(() => ID, {
    nullable: true,
    description: "Uma marca do catálogo (vazio: qualquer marca).",
  })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Observação do item (cor, medida, modelo…).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(PURCHASE_REQUEST_LIMITS.itemNote + 20)
  note?: string | null;
}
