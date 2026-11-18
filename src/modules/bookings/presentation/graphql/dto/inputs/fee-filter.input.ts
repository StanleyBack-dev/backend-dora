import { Field, ID, InputType } from "@nestjs/graphql";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";

@InputType({ description: "Filtros das taxas de uso de um mês." })
export class FeeFilterInput {
  @Field(() => ID, { nullable: true, description: "A unidade da reserva." })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field(() => ID, { nullable: true, description: "O espaço reservado." })
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @Field(() => ID, { nullable: true, description: "Quem reservou." })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field({
    nullable: true,
    description: "true: só as lançadas na cobrança; false: só as pendentes.",
  })
  @IsOptional()
  @IsBoolean()
  billed?: boolean;
}
