import { Field, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@InputType({ description: '"Perdi algo": o que o morador perdeu.' })
export class ReportLostItemInput {
  @Field(() => FoundItemCategory)
  @IsEnum(FoundItemCategory)
  category!: FoundItemCategory;

  @Field({ description: "O que é (ex.: chave com chaveiro azul)." })
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: "Detalhes que ajudam a reconhecer (cor, marca…).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Onde pode ter perdido.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  lostLocation?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "O dia em que perdeu (AAAA-MM-DD), se souber.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  lostOn?: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      "Foto do objeto ou de um parecido: JPEG, PNG ou WebP em base64 (sem o prefixo data:), até 1 MB.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  photo?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description:
      "Mostrar no mural dos vizinhos (sem o nome, a unidade e os detalhes).",
  })
  @IsOptional()
  @IsBoolean()
  shared?: boolean | null;
}
