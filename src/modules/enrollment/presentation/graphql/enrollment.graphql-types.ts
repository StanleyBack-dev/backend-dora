import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { EnrollmentStatus } from "@/modules/enrollment/domain/enrollment";
import { TemporaryAccessType } from "@/modules/identity/presentation/graphql/identity.graphql-types";

registerEnumType(EnrollmentStatus, {
  name: "EnrollmentStatus",
  description: "Situação do cadastro enviado pelo link público.",
});

// === outputs ===

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

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  rejectionReason!: string | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;
}

export const EnrollmentRequestPage = Paginated(
  EnrollmentRequestType,
  "EnrollmentRequestPage",
);

@ObjectType("EnrollmentApproval")
export class EnrollmentApprovalType {
  @Field(() => EnrollmentRequestType)
  request!: EnrollmentRequestType;

  @Field(() => TemporaryAccessType)
  access!: TemporaryAccessType;
}

// === inputs ===

@InputType()
export class CreateEnrollmentInviteInput {
  @Field()
  @IsString()
  @Length(2, 80)
  label!: string;

  @Field(() => Int, { description: "Validade em dias (1 a 30)." })
  @IsInt()
  @Min(1)
  @Max(30)
  validDays!: number;
}

@InputType({ description: "Dados do cadastro (formulário ou correção)." })
export class EnrollmentDataInput {
  @Field()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @Field()
  @IsString()
  @MaxLength(254)
  email!: string;

  @Field()
  @IsString()
  @MaxLength(20)
  phone!: string;
}

@InputType()
export class SubmitEnrollmentInput {
  @Field()
  @IsString()
  @MaxLength(300)
  formToken!: string;

  @Field(() => EnrollmentDataInput)
  @ValidateNested()
  @Type(() => EnrollmentDataInput)
  data!: EnrollmentDataInput;

  @Field({ description: "Aceite do uso dos dados (LGPD)." })
  @IsBoolean()
  consent!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Foto de perfil em base64 (JPEG, PNG ou WebP, até 2 MB).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_800_000)
  photo?: string | null;
}

@InputType()
export class EnrollmentRequestFilterInput {
  @Field(() => EnrollmentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
