import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";

@InputType({ description: "Ficha do funcionário (todos os campos opcionais)." })
export class EmployeeProfileInput {
  @Field(() => String, { nullable: true, description: "Cargo." })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  jobTitle?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Data de admissão (AAAA-MM-DD).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  hiredOn?: string | null;

  @Field(() => String, { nullable: true, description: "Turno ou jornada." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  workShift?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Empresa terceirizada, quando houver.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractor?: string | null;
}
