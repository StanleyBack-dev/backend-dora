import { Field, ID, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import { IsDate, IsUUID } from "class-validator";

@InputType()
export class WaitlistSlotInput {
  @Field(() => ID)
  @IsUUID()
  spaceId!: string;

  @Field({ description: "Início do horário reservado." })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;
}
