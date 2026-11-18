import { Field, ID, InputType } from "@nestjs/graphql";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";

@InputType({ description: "Filtros dos convidados de um dia." })
export class DayGuestFilterInput {
  @Field(() => ID, { nullable: true, description: "Um convidado." })
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @Field(() => ID, {
    nullable: true,
    description: "Quem reservou (quem convidou).",
  })
  @IsOptional()
  @IsUUID()
  hostId?: string;

  @Field(() => ID, { nullable: true, description: "A unidade da reserva." })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field(() => ID, { nullable: true, description: "O espaço reservado." })
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @Field({
    nullable: true,
    description: "true: só quem já entrou; false: só quem ainda não entrou.",
  })
  @IsOptional()
  @IsBoolean()
  checkedIn?: boolean;
}
