import { Field, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

@InputType()
export class CreateSpaceBlockInput {
  @Field(() => ID)
  @IsUUID()
  spaceId!: string;

  @Field()
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Field()
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @Field()
  @IsString()
  @MaxLength(400)
  reason!: string;

  @Field({
    description:
      "Cancela as reservas ativas do período (cada morador é avisado). Sem isso, a API diz quantas há.",
  })
  @IsBoolean()
  cancelOverlapping!: boolean;
}
