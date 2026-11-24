import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CATALOG_LIMITS as LIMITS } from "@/modules/catalog/domain/catalog";

/** Lengths here only stop abuse; the use case checks and normalizes it. */
@InputType({ description: "Dados de um produto do catálogo." })
export class ProductInput {
  @Field()
  @IsString()
  @MaxLength(LIMITS.productName + 20)
  name!: string;

  @Field({ description: "Unidade de costume (un, cx, kg…)." })
  @IsString()
  @MaxLength(LIMITS.unit + 20)
  unit!: string;

  @Field(() => String, {
    nullable: true,
    description: "O que identifica o produto (medida, modelo…).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.productDescription + 20)
  description?: string | null;
}
