import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { EnrollmentStatus } from "@/modules/enrollment/domain/enrollment";
import "@/modules/enrollment/presentation/graphql/enrollment.graphql-enums";

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

  @Field(() => ID, { nullable: true, description: "Exatamente este cadastro." })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @Field({ nullable: true, description: "Exatamente este e-mail." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;
}
