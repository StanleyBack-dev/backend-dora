import { Field, ID, InputType, Int } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { AttendeeSource } from "@/modules/events/domain/event-order";
import "@/modules/events/presentation/graphql/events.graphql-enums";

// One person of an order. Shape only: the domain checks it (event-order.ts).
@InputType()
export class AttendeeInput {
  @Field(() => AttendeeSource, {
    description: "Eu, um dependente aprovado ou outra pessoa.",
  })
  @IsEnum(AttendeeSource)
  source!: AttendeeSource;

  @Field(() => ID, { nullable: true, description: "Com DEPENDENT: qual." })
  @IsOptional()
  @IsUUID()
  dependentId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Com GUEST: nome completo.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @Field(() => Int, { nullable: true, description: "Com GUEST: idade." })
  @IsOptional()
  @IsInt()
  age?: number | null;

  @Field({ description: "Com GUEST: convidado de fora do condomínio." })
  @IsBoolean()
  outside!: boolean;

  @Field(() => ID, {
    nullable: true,
    description: "Ingresso (público) da pessoa, em evento com ingresso.",
  })
  @IsOptional()
  @IsUUID()
  ticketTypeId?: string | null;
}
