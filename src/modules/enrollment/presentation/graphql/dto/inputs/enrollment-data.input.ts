import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

@InputType({ description: "Dados do cadastro (formulário ou correção)." })
export class EnrollmentDataInput {
  @Field()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @Field()
  @IsString()
  @MaxLength(254)
  email!: string;

  @Field()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @Field(() => String, {
    nullable: true,
    description:
      "Data de nascimento AAAA-MM-DD (obrigatória no formulário público).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthDate?: string | null;

  @Field(() => ID, {
    nullable: true,
    description:
      "Unidade (obrigatória quando o condomínio tem unidades). Na aprovação, ausente mantém a escolhida.",
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Complemento do endereço no condomínio ("casa dos fundos").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  unitComplement?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Rua digitada (condomínio de casas; com a quadra em unitBlock e o lote em unitNumber).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  unitStreet?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Bloco ou torre digitado (quando o condomínio ainda não tem unidades); em casas, a quadra.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  unitBlock?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Número da casa ou apartamento digitado (quando o condomínio ainda não tem unidades). Na aprovação, ausente mantém o informado.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unitNumber?: string | null;
}
