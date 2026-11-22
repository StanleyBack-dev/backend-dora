import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("CatalogOption", {
  description:
    "Um produto ou marca nos selects (os novos usos oferecem só os ativos).",
})
export class CatalogOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  active!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Produtos: a unidade de costume.",
  })
  unit?: string | null;
}
