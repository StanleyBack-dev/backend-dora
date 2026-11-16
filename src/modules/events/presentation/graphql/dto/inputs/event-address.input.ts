import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, MaxLength } from "class-validator";

// Shape only: shared/domain/brazilian-address.ts checks the content.
@InputType({ description: "Endereço do local fora do condomínio." })
export class EventAddressInput {
  @Field({ description: "CEP (8 números)." })
  @IsString()
  @MaxLength(20)
  zip!: string;

  @Field()
  @IsString()
  @MaxLength(200)
  street!: string;

  @Field({ description: 'Número ou "S/N".' })
  @IsString()
  @MaxLength(20)
  number!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  complement?: string | null;

  @Field()
  @IsString()
  @MaxLength(120)
  district!: string;

  @Field()
  @IsString()
  @MaxLength(120)
  city!: string;

  @Field({ description: "UF." })
  @IsString()
  @MaxLength(2)
  state!: string;
}
