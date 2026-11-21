import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import {
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

@InputType({ description: "Filtros dos itens achados." })
export class FoundItemFilterInput {
  @Field(() => [FoundItemStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(FoundItemStatus, { each: true })
  statuses?: FoundItemStatus[];

  @Field(() => FoundItemCategory, { nullable: true })
  @IsOptional()
  @IsEnum(FoundItemCategory)
  category?: FoundItemCategory;

  @Field({
    nullable: true,
    description: "Parte do que é, da descrição ou de onde foi achado.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @Field({ nullable: true, description: "Exatamente este item (o que é)." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @Field({
    nullable: true,
    description: "Exatamente este local onde foi achado.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  foundLocation?: string;

  @Field({ nullable: true, description: "Exatamente este local de guarda." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storageLocation?: string;

  @Field(() => ID, {
    nullable: true,
    description: "Itens reservados para este morador ou que ele pediu.",
  })
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: "Só os itens com pedidos aguardando.",
  })
  @IsOptional()
  @IsBoolean()
  withPendingClaims?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  to?: Date;
}
