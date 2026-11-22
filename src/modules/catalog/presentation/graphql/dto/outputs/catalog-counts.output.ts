import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("CatalogCounts", {
  description: "Quantos produtos (ou marcas) estão ativos e inativos.",
})
export class CatalogCountsType {
  @Field(() => Int)
  active!: number;

  @Field(() => Int)
  inactive!: number;
}
