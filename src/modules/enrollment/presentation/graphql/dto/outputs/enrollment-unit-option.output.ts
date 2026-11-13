import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("EnrollmentUnitOption")
export class EnrollmentUnitOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;
}
