import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

@InputType({ description: "Filtros das encomendas do condomínio." })
export class ParcelFilterInput {
  @Field(() => [ParcelStatus], {
    nullable: true,
    description: "Só estas situações (vazio: todas).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(ParcelStatus, { each: true })
  statuses?: ParcelStatus[];

  @Field(() => ID, { nullable: true, description: "A unidade." })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field({
    nullable: true,
    description:
      "Parte do código de retirada, do rastreio, do destinatário ou da transportadora.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @Field({ nullable: true, description: "Recebidas a partir deste instante." })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field({ nullable: true, description: "Recebidas antes deste instante." })
  @IsOptional()
  @IsDate()
  to?: Date;
}
