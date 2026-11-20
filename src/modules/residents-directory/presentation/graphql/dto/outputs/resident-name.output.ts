import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("ResidentName", {
  description: "Um morador no filtro de nome da consulta.",
})
export class ResidentNameType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}
