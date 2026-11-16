import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("EmployeeProfile", { description: "Ficha do funcionário." })
export class EmployeeProfileType {
  @Field(() => String, { nullable: true })
  jobTitle!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Data de admissão (AAAA-MM-DD).",
  })
  hiredOn!: string | null;

  @Field(() => String, { nullable: true })
  workShift!: string | null;

  @Field(() => String, { nullable: true })
  contractor!: string | null;
}
