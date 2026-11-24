import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { Category } from "@/modules/catalog/domain/category";
import { SupplierDocumentType } from "@/modules/suppliers/domain/supplier";
import "@/modules/suppliers/presentation/graphql/suppliers.graphql-enums";
import { PixKeyType } from "@/shared/domain/pix";

@ObjectType("Supplier", {
  description: "Fornecedor do condomínio (empresa ou autônomo).",
})
export class SupplierType {
  @Field(() => ID)
  id!: string;

  @Field(() => SupplierDocumentType)
  documentType!: SupplierDocumentType;

  @Field({ description: "CNPJ ou CPF, só os números." })
  document!: string;

  @Field({ description: "Razão social, ou o nome do autônomo." })
  name!: string;

  @Field(() => String, { nullable: true })
  tradeName!: string | null;

  @Field(() => [Category])
  categories!: Category[];

  @Field(() => String, {
    nullable: true,
    description: "Com OTHER entre as categorias: o que ele atende, digitado.",
  })
  categoryOther!: string | null;

  @Field(() => String, { nullable: true })
  contactName!: string | null;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Só os números, com DDD.",
  })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  city!: string | null;

  @Field(() => String, { nullable: true })
  state!: string | null;

  @Field(() => PixKeyType, { nullable: true })
  pixKeyType!: PixKeyType | null;

  @Field(() => String, { nullable: true })
  pixKey!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field()
  active!: boolean;

  @Field(() => Float, {
    nullable: true,
    description: "A média das avaliações, de 1 a 5 (null: nunca avaliado).",
  })
  ratingAverage!: number | null;

  @Field(() => Int, { description: "Quantas avaliações recebeu." })
  ratingCount!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
