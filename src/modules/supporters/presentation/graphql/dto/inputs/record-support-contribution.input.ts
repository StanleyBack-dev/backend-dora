import { Field, InputType, Int } from "@nestjs/graphql";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

// Shape only: the domain trims and checks the content (supporter.ts).
@InputType()
export class RecordSupportContributionInput {
  @Field({
    description:
      "Nome do apoiador. Um nome que já está na lista soma a esse apoiador.",
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @Field({
    description: 'Falso: o ranking mostra "Apoiador anônimo" no lugar do nome.',
  })
  @IsBoolean()
  showName!: boolean;

  @Field(() => Int, { description: "Valor em centavos." })
  @IsInt()
  amountCents!: number;

  @Field({ description: "Dia em que o apoio chegou (YYYY-MM-DD)." })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  receivedOn!: string;

  @Field(() => String, {
    nullable: true,
    description: "Observação interna (não aparece no ranking).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  note?: string | null;
}
