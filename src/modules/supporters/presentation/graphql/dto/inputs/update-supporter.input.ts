import { Field, InputType } from "@nestjs/graphql";
import { IsBoolean, IsString, MaxLength } from "class-validator";

@InputType()
export class UpdateSupporterInput {
  @Field()
  @IsString()
  @MaxLength(120)
  name!: string;

  @Field({ description: 'Falso: aparece como "Apoiador anônimo".' })
  @IsBoolean()
  showName!: boolean;
}
