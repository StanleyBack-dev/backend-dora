import { Field, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { EnrollmentDataInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/enrollment-data.input";

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
