import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";

@InputType()
export class UpdateUnitInput {
  @Field(() => String, {
    nullable: true,
    description: "Rua (só em condomínios de casas).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  street?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  block?: string | null;

  @Field()
  @IsString()
  @MaxLength(40)
  number!: string;
}
