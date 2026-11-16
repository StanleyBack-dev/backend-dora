import { Field, ID, InputType, Int } from "@nestjs/graphql";
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { EventAddressInput } from "@/modules/events/presentation/graphql/dto/inputs/event-address.input";

// Shape only: the domain trims and checks the content (event.ts).
@InputType()
export class EventInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @Field(() => ID, {
    nullable: true,
    description: "Espaço do condomínio (sem espaço: informe o endereço).",
  })
  @IsOptional()
  @IsUUID()
  spaceId?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Com espaço, um detalhe ("área coberta"); fora, o nome do local ("Chácara Bela Vista").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @Field(() => EventAddressInput, {
    nullable: true,
    description: "Obrigatório sem espaço: o evento é fora do condomínio.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EventAddressInput)
  address?: EventAddressInput | null;

  @Field()
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Field()
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @Field(() => Int, { description: "Lotação total." })
  @IsInt()
  capacity!: number;

  @Field(() => Int, {
    description: "Convidados de fora do condomínio (0: só moradores).",
  })
  @IsInt()
  externalGuestLimit!: number;

  @Field({ description: "Entrada com ingresso pago (Pix)." })
  @IsBoolean()
  ticketed!: boolean;
}
