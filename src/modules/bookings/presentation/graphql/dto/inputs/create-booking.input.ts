import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsDate,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  @IsUUID()
  spaceId!: string;

  @Field({ description: "Início de um dos horários da grade." })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Field(() => String, { nullable: true, description: "Observação (até 300)." })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string | null;
}
