import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("PurchaseSummaryFile", {
  description:
    "Resumo da compra em PDF: solicitação, cotações, escolha, aprovação e linha do tempo.",
})
export class PurchaseSummaryFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}
