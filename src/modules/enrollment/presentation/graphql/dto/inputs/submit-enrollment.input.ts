import { Field, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { EnrollmentApplicant } from "@/modules/enrollment/domain/enrollment";
import { EnrollmentDataInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/enrollment-data.input";
import "@/modules/enrollment/presentation/graphql/enrollment.graphql-enums";

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

  @Field(() => EnrollmentApplicant, {
    nullable: true,
    description:
      "Morador (padrão) ou funcionário. Funcionário não informa unidade nem endereço.",
  })
  @IsOptional()
  @IsEnum(EnrollmentApplicant)
  applicant?: EnrollmentApplicant | null;

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
