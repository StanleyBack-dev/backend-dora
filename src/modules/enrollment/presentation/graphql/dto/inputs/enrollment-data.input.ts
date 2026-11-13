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

  @Field(() => ID, {
    nullable: true,
    description:
      "Unidade (obrigatória quando o condomínio tem unidades). Na aprovação, ausente mantém a escolhida.",
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;
}
