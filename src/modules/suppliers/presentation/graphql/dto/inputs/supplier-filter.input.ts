import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { Category } from "@/modules/catalog/domain/category";
import "@/modules/suppliers/presentation/graphql/suppliers.graphql-enums";

@InputType({ description: "Filtros dos fornecedores." })
export class SupplierFilterInput {
  @Field(() => ID, {
    nullable: true,
    description: "Exatamente este fornecedor.",
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Field({ nullable: true, description: "Exatamente este contato." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactName?: string;

  @Field({
    nullable: true,
    description: "Exatamente este CNPJ/CPF (com ou sem pontuação).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @Field(() => Category, { nullable: true })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @Field(() => Boolean, {
    nullable: true,
    description: "Só os ativos (true) ou só os inativos (false); vazio: todos.",
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
