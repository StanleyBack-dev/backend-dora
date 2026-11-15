import { Field, ID, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

@InputType()
export class CreateBookingSeriesInput {
  @Field(() => ID)
  @IsUUID()
  spaceId!: string;

  @Field({ description: "Primeira data: um dos horários da grade." })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Field(() => Int, { description: "Quantas semanas (2 a 26)." })
  @IsInt()
  weeks!: number;

  @Field(() => String, { nullable: true, description: "Observação (até 300)." })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string | null;
}
