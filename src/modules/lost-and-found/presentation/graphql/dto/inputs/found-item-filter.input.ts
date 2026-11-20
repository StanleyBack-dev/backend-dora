import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
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
