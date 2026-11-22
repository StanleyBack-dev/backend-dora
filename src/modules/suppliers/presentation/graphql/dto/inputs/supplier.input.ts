import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ALL_CATEGORIES, Category } from "@/modules/catalog/domain/category";
import {
  SUPPLIER_TEXT_LIMITS,
  SupplierDocumentType,
} from "@/modules/suppliers/domain/supplier";
import "@/modules/suppliers/presentation/graphql/suppliers.graphql-enums";
import { PixKeyType } from "@/shared/domain/pix";

// Lengths here only stop abuse; the use case checks and normalizes each
// field (with the messages the form shows).
@InputType({ description: "Dados de um fornecedor." })
export class SupplierInput {
  @Field(() => SupplierDocumentType)
  @IsEnum(SupplierDocumentType)
  documentType!: SupplierDocumentType;

  @Field({ description: "CNPJ ou CPF (com ou sem pontuação)." })
  @IsString()
  @MaxLength(20)
  document!: string;

  @Field({ description: "Razão social, ou o nome do autônomo." })
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.name + 20)
  name!: string;

  @Field(() => String, { nullable: true, description: "Nome fantasia." })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.tradeName + 20)
  tradeName?: string | null;

  @Field(() => [Category], {
    description: "O que o fornecedor atende (ao menos uma).",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ALL_CATEGORIES.length)
  @IsEnum(Category, { each: true })
  categories!: Category[];

  @Field(() => String, {
    nullable: true,
    description:
      "Com OTHER entre as categorias: o que ele atende, digitado (ex.: dedetização).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.categoryOther + 20)
  categoryOther?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.contactName + 20)
  contactName?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.email + 20)
  email?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.city + 20)
  city?: string | null;

  @Field(() => String, { nullable: true, description: "UF (ex.: GO)." })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string | null;

  @Field(() => PixKeyType, { nullable: true })
  @IsOptional()
  @IsEnum(PixKeyType)
  pixKeyType?: PixKeyType | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pixKey?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUPPLIER_TEXT_LIMITS.notes + 20)
  notes?: string | null;
}
