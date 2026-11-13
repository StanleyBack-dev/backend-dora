import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("EnrollmentInvite", {
  description: "Código de convite para o formulário público de cadastro.",
})
export class EnrollmentInviteType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  label!: string;

  @Field()
  expiresAt!: Date;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field(() => Int, { description: "Cadastros enviados com este código." })
  requestCount!: number;
}
