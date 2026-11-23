import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
} from "class-validator";
import { SHARE_LIMITS } from "@/modules/purchases/application/use-cases/share-quote-map.use-case";

@InputType({ description: "Envio do mapa de cotação por e-mail." })
export class ShareQuoteMapInput {
  @Field(() => [String], { description: "De 1 a 5 e-mails." })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SHARE_LIMITS.maxRecipients)
  @IsEmail({}, { each: true })
  emails!: string[];

  @Field({ description: "A mensagem que vai no e-mail." })
  @IsString()
  @MaxLength(SHARE_LIMITS.message)
  message!: string;
}
