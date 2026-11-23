import { Field, ID, ObjectType } from "@nestjs/graphql";
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
}
