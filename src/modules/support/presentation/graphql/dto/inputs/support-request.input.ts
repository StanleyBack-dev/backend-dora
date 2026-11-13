import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsString, MaxLength } from "class-validator";
import { SupportCategory } from "@/modules/support/domain/support-request";
import "@/modules/support/presentation/graphql/support.graphql-enums";

@InputType()
export class SupportRequestInput {
  @Field(() => SupportCategory)
  @IsEnum(SupportCategory)
  category!: SupportCategory;

  @Field()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @Field()
  @IsString()
  @MaxLength(4000)
  message!: string;
}
