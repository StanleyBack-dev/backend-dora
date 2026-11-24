import { Field, ID, InputType } from "@nestjs/graphql";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";

@InputType({ description: "Filtros dos produtos ou das marcas." })
export class CatalogFilterInput {
  @Field(() => ID, { nullable: true, description: "Exatamente este." })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: "Só os ativos (true) ou só os inativos (false); vazio: todos.",
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
