import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
} from "class-validator";
import { EMAIL_LIMITS } from "@/modules/purchases/application/purchase-document-mailer";

@InputType({
  description:
    "Envio de um documento da compra (mapa, ordem de compra) por e-mail.",
})
export class PurchaseEmailInput {
  @Field(() => [String], { description: "De 1 a 5 e-mails." })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EMAIL_LIMITS.maxRecipients)
  @IsEmail({}, { each: true })
  emails!: string[];

  @Field({ description: "A mensagem que vai no e-mail." })
  @IsString()
  @MaxLength(EMAIL_LIMITS.message)
  message!: string;
}
