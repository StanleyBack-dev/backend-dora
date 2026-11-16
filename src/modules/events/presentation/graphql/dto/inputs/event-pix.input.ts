import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsString, MaxLength } from "class-validator";
import { PixKeyType } from "@/shared/domain/pix";
import "@/common/graphql/pix-key-type.enum";

// The event's own PIX. Shape only: the domain normalizes it (shared/pix.ts).
@InputType()
export class EventPixInput {
  @Field(() => PixKeyType, {
    description: "Tipo da chave: define como ela é conferida.",
  })
  @IsEnum(PixKeyType)
  keyType!: PixKeyType;

  @Field({ description: "Chave PIX." })
  @IsString()
  @MaxLength(120)
  key!: string;

  @Field({ description: "Nome de quem recebe, como aparece no banco." })
  @IsString()
  @MaxLength(80)
  name!: string;

  @Field({ description: "Cidade de quem recebe." })
  @IsString()
  @MaxLength(80)
  city!: string;
}
