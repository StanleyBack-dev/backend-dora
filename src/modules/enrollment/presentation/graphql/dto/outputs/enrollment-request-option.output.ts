import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType("EnrollmentRequestOption", {
  description: "Um cadastro como os filtros de nome e e-mail o oferecem.",
})
export class EnrollmentRequestOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  email!: string;
}
