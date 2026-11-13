import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("RecordStamp", {
  description: "Quem criou e quem alterou por último um registro.",
})
export class RecordStampType {
  @Field()
  createdAt!: Date;

  @Field(() => ID, { nullable: true })
  createdById!: string | null;

  @Field(() => String, { nullable: true })
  createdByName!: string | null;

  @Field()
  updatedAt!: Date;

  @Field(() => ID, { nullable: true })
  updatedById!: string | null;

  @Field(() => String, { nullable: true })
  updatedByName!: string | null;
}
