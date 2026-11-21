import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@InputType({ description: "Item achado no condomínio." })
export class RegisterFoundItemInput {
  @Field(() => FoundItemCategory)
  @IsEnum(FoundItemCategory)
  category!: FoundItemCategory;

  @Field({ description: "O que é (ex.: chave com chaveiro azul)." })
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: "O que os moradores veem sobre o item.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Só a portaria e a gestão veem: detalhes para conferir o dono (ex.: o que tem dentro).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  privateDetails?: string | null;

  @Field({ description: "Onde foi achado." })
  @IsString()
  @MaxLength(200)
  foundLocation!: string;

  @Field(() => Date, {
    nullable: true,
    description: "Quando foi achado (padrão: agora).",
  })
  @IsOptional()
  @IsDate()
  foundAt?: Date | null;

  @Field({ description: "Onde ficou guardado." })
  @IsString()
  @MaxLength(200)
  storageLocation!: string;

  @Field(() => String, {
    nullable: true,
    description: "Foto (JPEG, PNG ou WebP em base64, até 1 MB).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  photo?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: "Esconder a foto dos moradores (padrão: só documentos).",
  })
  @IsOptional()
  @IsBoolean()
  photoHidden?: boolean | null;

  @Field(() => ID, {
    nullable: true,
    description:
      "De quem é, se a portaria sabe: a unidade (os moradores dela são avisados e veem o item).",
  })
  @IsOptional()
  @IsUUID()
  ownerUnitId?: string | null;

  @Field(() => ID, {
    nullable: true,
    description:
      "Ou um morador da unidade (com ownerUnitId), ou alguém da equipe (sem unidade): só essa pessoa é avisada e vê o item, com o pedido já aceito.",
  })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @Field(() => ID, {
    nullable: true,
    description:
      'O aviso de "Perdi algo" que o item atende: ele se encerra como encontrado, ligado ao item.',
  })
  @IsOptional()
  @IsUUID()
  lostReportId?: string | null;
}
