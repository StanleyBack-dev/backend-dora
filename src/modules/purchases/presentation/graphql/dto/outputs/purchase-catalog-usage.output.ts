import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseCatalogTop", {
  description: "O produto (ou marca) em mais solicitações.",
})
export class PurchaseCatalogTopType {
  @Field()
  name!: string;

  @Field(() => Int)
  requestCount!: number;
}

@ObjectType("PurchaseCatalogUsage", {
  description:
    "Como os produtos e marcas do catálogo aparecem nas solicitações de compra.",
})
export class PurchaseCatalogUsageType {
  @Field(() => Int, { description: "Produtos em ao menos uma solicitação." })
  productsInUse!: number;

  @Field(() => PurchaseCatalogTopType, { nullable: true })
  topProduct!: PurchaseCatalogTopType | null;

  @Field(() => Int, { description: "Marcas em ao menos uma solicitação." })
  brandsInUse!: number;

  @Field(() => PurchaseCatalogTopType, { nullable: true })
  topBrand!: PurchaseCatalogTopType | null;
}
