import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

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

  @Field(() => String, {
    nullable: true,
    description: "Transportadora ou loja (Correios, Mercado Livre…).",
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
    description: "Onde ficou guardada (prateleira, armário, administração…).",
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
}
