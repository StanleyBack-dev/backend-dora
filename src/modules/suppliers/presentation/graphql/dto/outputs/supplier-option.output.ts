import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { Category } from "@/modules/catalog/domain/category";
import "@/modules/suppliers/presentation/graphql/suppliers.graphql-enums";

@ObjectType("SupplierOption", {
  description: "Um fornecedor ativo num select, com o que atende.",
})
export class SupplierOptionType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "Nome fantasia, ou a razão social." })
  name!: string;

  @Field(() => [Category])
  categories!: Category[];

  @Field(() => String, { nullable: true })
  categoryOther!: string | null;

  @Field(() => Float, {
    nullable: true,
    description: "A média das avaliações, de 1 a 5 (null: nunca avaliado).",
  })
  ratingAverage!: number | null;

  @Field(() => Int, { description: "Quantas avaliações recebeu." })
  ratingCount!: number;
}
