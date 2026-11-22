import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("Product", {
  description:
    "Produto do catálogo do condomínio (usado pelas compras e, no futuro, por outros módulos).",
})
export class ProductType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ description: "Unidade de costume (un, cx, kg…)." })
  unit!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  active!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
