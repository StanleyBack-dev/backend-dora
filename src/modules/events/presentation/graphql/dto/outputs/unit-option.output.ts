import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("UnitOption", {
  description: "Uma unidade para escolher num filtro.",
})
export class UnitOptionType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "Ex.: Bloco A · 101." })
  label!: string;
}
