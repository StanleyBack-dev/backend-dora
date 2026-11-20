import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("ParcelReceiptFile", {
  description: "Comprovante de retirada em PDF.",
})
export class ParcelReceiptFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}
