import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { DocumentType } from "@/shared/domain/identity-document";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

// Shape only: the domain trims and checks the content (booking-guest.ts).
@InputType()
export class GuestInput {
  @Field()
  @IsString()
  @MaxLength(240)
  name!: string;

  @Field(() => DocumentType, {
    nullable: true,
    description: "Tipo do documento (obrigatório com documento).",
  })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType | null;

  @Field(() => String, {
    nullable: true,
    description: "CPF (11 números) ou RG (7 a 10: números e um X no fim).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  document?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
