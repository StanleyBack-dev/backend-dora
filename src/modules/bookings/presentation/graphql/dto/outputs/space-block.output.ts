import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("SpaceBlock", {
  description: "Período em que o espaço não aceita reservas.",
})
export class SpaceBlockType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  spaceId!: string;

  @Field()
  startsAt!: Date;

  @Field()
  endsAt!: Date;

  @Field()
  reason!: string;

  @Field(() => String, { nullable: true })
  createdByName!: string | null;

  @Field()
  createdAt!: Date;
}
