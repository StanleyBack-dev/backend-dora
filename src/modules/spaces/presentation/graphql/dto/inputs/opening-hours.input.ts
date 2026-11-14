import { Field, InputType, Int } from "@nestjs/graphql";
import { IsInt, IsString, Matches, Max, Min } from "class-validator";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

@InputType()
export class OpeningHoursInput {
  @Field(() => Int, { description: "0 = domingo … 6 = sábado." })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Field({ description: '"HH:MM".' })
  @IsString()
  @Matches(TIME)
  opensAt!: string;

  @Field({ description: '"HH:MM" ("24:00" = até meia-noite).' })
  @IsString()
  @Matches(TIME)
  closesAt!: string;
}
