import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";

@InputType()
export class CondominiumInput {
  @Field()
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field(() => String, { nullable: true, description: "CNPJ (opcional)." })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string | null;

  @Field()
  @IsString()
  @MaxLength(120)
  city!: string;

  @Field({ description: "UF." })
  @IsString()
  @MaxLength(2)
  state!: string;
}
