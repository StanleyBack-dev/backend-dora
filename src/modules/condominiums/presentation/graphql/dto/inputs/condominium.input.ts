import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { AddressFormat } from "@/modules/condominiums/domain/condominium";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@InputType()
export class CondominiumInput {
  @Field()
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field(() => String, { nullable: true, description: "CNPJ (opcional)." })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  document?: string | null;

  @Field()
  @IsString()
  @MaxLength(120)
  city!: string;

  @Field({ description: "UF." })
  @IsString()
  @MaxLength(2)
  state!: string;

  @Field(() => AddressFormat, {
    nullable: true,
    description:
      "Apartamentos (bloco e número, padrão) ou casas (rua, quadra e lote).",
  })
  @IsOptional()
  @IsEnum(AddressFormat)
  addressFormat?: AddressFormat | null;
}
