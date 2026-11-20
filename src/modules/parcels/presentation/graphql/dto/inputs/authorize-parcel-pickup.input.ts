import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/parcels/presentation/graphql/parcels.graphql-enums";

@InputType({ description: "Pessoa autorizada a retirar uma encomenda." })
export class AuthorizeParcelPickupInput {
  @Field(() => ID)
  @IsUUID()
  parcelId!: string;

  @Field({ description: "Nome completo de quem vai retirar." })
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field(() => DocumentType, { nullable: true })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType | null;

  @Field(() => String, { nullable: true, description: "CPF ou RG (opcional)." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string | null;
}
