import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";

@InputType()
export class CreateUnitsInput {
  @Field(() => String, { nullable: true, description: "Bloco ou torre." })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  block?: string | null;

  @Field({ description: 'Números e faixas: "101-104, 201".' })
  @IsString()
  @MaxLength(4000)
  numbers!: string;
}
