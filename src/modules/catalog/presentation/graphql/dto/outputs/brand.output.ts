import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("Brand", { description: "Marca do catálogo do condomínio." })
export class BrandType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  active!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
