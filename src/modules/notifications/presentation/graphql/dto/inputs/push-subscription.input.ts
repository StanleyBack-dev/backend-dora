import { Field, InputType } from "@nestjs/graphql";
import { IsString, IsUrl, Length, MaxLength } from "class-validator";

@InputType({ description: "PushSubscription do navegador (PushManager)." })
export class PushSubscriptionInput {
  @Field()
  @IsUrl({ protocols: ["https"], require_tld: false })
  @MaxLength(1000)
  endpoint!: string;

  @Field({ description: "Chave pública do aparelho (base64url)." })
  @IsString()
  @Length(20, 200)
  p256dh!: string;

  @Field({ description: "Segredo de autenticação (base64url)." })
  @IsString()
  @Length(8, 100)
  auth!: string;
}
