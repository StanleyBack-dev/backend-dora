import { Field, ID, ObjectType } from "@nestjs/graphql";
import {
  EnrollmentApplicant,
  EnrollmentStatus,
} from "@/modules/enrollment/domain/enrollment";
import "@/modules/enrollment/presentation/graphql/enrollment.graphql-enums";

@ObjectType("EnrollmentRequest")
export class EnrollmentRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => EnrollmentStatus)
  status!: EnrollmentStatus;

  @Field(() => EnrollmentApplicant, {
    description: "Morador ou funcionário (funcionário não tem unidade).",
  })
  applicant!: EnrollmentApplicant;

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

  @Field(() => String, {
    nullable: true,
    description: 'Complemento do endereço no condomínio ("casa dos fundos").',
  })
  unitComplement!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Unidade digitada (condomínio sem unidades cadastradas): "Bloco A · 101".',
  })
  typedUnitLabel!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Bloco ou torre digitado (null: sem bloco ou unidade escolhida).",
  })
  typedUnitBlock!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Número digitado (null: unidade escolhida na lista).",
  })
  typedUnitNumber!: string | null;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  rejectionReason!: string | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;
}
