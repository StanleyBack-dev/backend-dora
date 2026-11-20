import { Field, ID, InputType, Int } from "@nestjs/graphql";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

@InputType({ description: "Encomenda recebida na portaria." })
export class RegisterParcelInput {
  @Field(() => ID, { description: "A unidade de destino." })
  @IsUUID()
  unitId!: string;

  @Field(() => String, { nullable: true, description: "Nome na etiqueta." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string | null;

  @Field(() => ID, {
    nullable: true,
    description:
      "Escolhido pelo nome: só este morador (da unidade) é avisado e vê a encomenda (surpresa, presente). Nulo: todos da unidade.",
  })
  @IsOptional()
  @IsUUID()
  recipientUserId?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Transportadora ou loja (Correios, Mercado Livre… ou digitada). Obrigatório.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  carrier?: string | null;

  @Field(() => String, { nullable: true, description: "Código de rastreio." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingCode?: string | null;

  @Field(() => String, { nullable: true, description: "Observação." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Onde ficou guardada (prateleira, armário, administração…). Obrigatório.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Foto da encomenda (JPEG, PNG ou WebP em base64, até 1 MB).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  photo?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description:
      "Perecível (alimento, remédio, flores…): retirar dentro do prazo, com lembretes a cada 2 horas.",
  })
  @IsOptional()
  @IsBoolean()
  perishable?: boolean | null;

  @Field(() => Int, {
    nullable: true,
    description: "Perecível: prazo em horas (2, 4, 8, 12, 24 ou 48; padrão 4).",
  })
  @IsOptional()
  @IsInt()
  perishableHours?: number | null;
}
