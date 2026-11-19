import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { UnitOccupancy } from "@/modules/condominiums/domain/unit";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@InputType({ description: "O que filtra a página de unidades." })
export class UnitFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field({
    nullable: true,
    description: 'Exatamente este bloco (a quadra, em casas; "" = sem bloco).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  block?: string;

  @Field({ nullable: true, description: "Exatamente esta rua (casas)." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  street?: string;

  @Field(() => UnitOccupancy, { nullable: true })
  @IsOptional()
  @IsEnum(UnitOccupancy)
  occupancy?: UnitOccupancy;
}
