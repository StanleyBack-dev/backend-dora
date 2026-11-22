import { Field, ID, ObjectType } from "@nestjs/graphql";
import { PurchaseCategory } from "@/modules/purchases/domain/purchase-category";
import { SupplierDocumentType } from "@/modules/purchases/domain/supplier";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";
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

  @Field(() => [PurchaseCategory])
  categories!: PurchaseCategory[];

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

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
