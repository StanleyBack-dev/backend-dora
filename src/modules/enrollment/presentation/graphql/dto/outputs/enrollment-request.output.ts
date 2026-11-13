import { Field, ID, ObjectType } from "@nestjs/graphql";
import { EnrollmentStatus } from "@/modules/enrollment/domain/enrollment";
import "@/modules/enrollment/presentation/graphql/enrollment.graphql-enums";

@ObjectType("EnrollmentRequest")
export class EnrollmentRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => EnrollmentStatus)
  status!: EnrollmentStatus;

  @Field()
  fullName!: string;

  @Field()
  email!: string;

  @Field()
  phone!: string;

  @Field(() => ID, { nullable: true })
  unitId!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Unidade escolhida: "Bloco A · 101".',
  })
  unitLabel!: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  rejectionReason!: string | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;
}
