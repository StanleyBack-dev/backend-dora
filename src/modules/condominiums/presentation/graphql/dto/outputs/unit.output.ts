import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("Unit", { description: "Unidade (apartamento, casa)." })
export class UnitType {
  @Field(() => ID)
  id!: string;

  @Field({ description: 'Bloco ou torre ("" quando não há).' })
  block!: string;

  @Field()
  number!: string;

  @Field({ description: 'Como exibir: "Bloco A · 101".' })
  label!: string;

  @Field(() => Int, { description: "Membros ativos vinculados." })
  residents!: number;
}
