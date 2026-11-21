import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("FoundItemStaffOption", {
  description: "Alguém da equipe (portaria ou gestão), para indicar o dono.",
})
export class FoundItemStaffOptionType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field({ description: "Portaria ou Gestão." })
  roleLabel!: string;
}
