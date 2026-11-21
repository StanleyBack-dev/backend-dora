import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("FoundItemReceiptFile", {
  description: "Comprovante de devolução de um item achado, em PDF.",
})
export class FoundItemReceiptFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}
