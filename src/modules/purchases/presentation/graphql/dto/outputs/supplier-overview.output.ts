import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SupplierOverview", {
  description:
    "Os fornecedores em números (os cards da página), independente dos filtros.",
})
export class SupplierOverviewType {
  @Field(() => Int)
  active!: number;

  @Field(() => Int)
  inactive!: number;

  @Field(() => Int, { description: "Ativos sem chave PIX para pagamento." })
  activeWithoutPix!: number;

  @Field(() => Int, { description: "Ativos sem telefone nem e-mail." })
  activeWithoutContact!: number;

  @Field(() => Int, {
    description: "Categorias atendidas por ao menos um fornecedor ativo.",
  })
  categoriesServed!: number;
}
