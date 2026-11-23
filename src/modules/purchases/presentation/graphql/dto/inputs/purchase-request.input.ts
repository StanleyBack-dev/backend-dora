import { Field, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ALL_CATEGORIES, Category } from "@/modules/catalog/domain/category";
import {
  PURCHASE_REQUEST_LIMITS as LIMITS,
  PurchasePriority,
} from "@/modules/purchases/domain/purchase-request";
import { PurchaseRequestItemInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request-item.input";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

/**
 * Lengths here only stop abuse; the use case checks and normalizes each
 * field (with the messages the form shows).
 */
@InputType({ description: "Dados de uma solicitação de compra." })
export class PurchaseRequestInput {
  @Field({ description: "O que precisa ser comprado ou contratado." })
  @IsString()
  @MaxLength(LIMITS.title + 20)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.description + 20)
  description?: string | null;

  @Field(() => [Category], {
    description: "De que é a compra (ao menos uma).",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_CATEGORIES.length)
  @IsEnum(Category, { each: true })
  categories!: Category[];

  @Field(() => String, {
    nullable: true,
    description: "Com OTHER entre as categorias: de que é a compra, digitado.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.categoryOther + 20)
  categoryOther?: string | null;

  @Field(() => PurchasePriority, {
    nullable: true,
    description: "Vazio: normal.",
  })
  @IsOptional()
  @IsEnum(PurchasePriority)
  priority?: PurchasePriority | null;

  @Field(() => ID, {
    nullable: true,
    description: "Um espaço do condomínio onde vai ser usado.",
  })
  @IsOptional()
  @IsUUID()
  spaceId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Outro local (sem espaço), digitado.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.location + 20)
  location?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Dia em que precisa (AAAA-MM-DD), hoje ou depois.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  neededBy?: string | null;

  @Field(() => [PurchaseRequestItemInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.maxItems)
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemInput)
  items!: PurchaseRequestItemInput[];
}
