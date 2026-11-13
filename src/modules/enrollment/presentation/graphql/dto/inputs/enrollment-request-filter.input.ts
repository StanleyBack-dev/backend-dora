import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
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
}
