import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  ApprovalDecision,
  ApprovalMode,
} from "@/modules/purchases/domain/purchase-approval";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("PurchaseSettings", {
  description: "Como o condomínio aprova as compras (a alçada).",
})
export class PurchaseSettingsType {
  @Field(() => ApprovalMode)
  approvalMode!: ApprovalMode;

  @Field(() => Float, {
    nullable: true,
    description:
      "Com LIMIT: até este valor (centavos) a compra segue aprovada.",
  })
  approvalLimitCents!: number | null;

  @Field(() => Date, { nullable: true, description: "Vazio: nunca alterada." })
  updatedAt!: Date | null;

  @Field(() => String, { nullable: true })
  updatedByName!: string | null;
}

@ObjectType("PurchaseApproval", {
  description: "Uma decisão sobre a compra, como era na hora.",
})
export class PurchaseApprovalType {
  @Field(() => ID)
  id!: string;

  @Field(() => ApprovalDecision)
  decision!: ApprovalDecision;

  @Field()
  supplierName!: string;

  @Field(() => Float, { description: "Total da cotação, em centavos." })
  totalCents!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      "A alçada em vigor (vazio: toda compra passava por aprovação).",
  })
  limitCents!: number | null;

  @Field(() => String, {
    nullable: true,
    description: "Observação (aprovada) ou motivo (devolvida, reprovada).",
  })
  note!: string | null;

  @Field(() => String, { nullable: true })
  chosenByName!: string | null;

  @Field(() => String, { nullable: true })
  decidedByName!: string | null;

  @Field()
  decidedAt!: Date;
}

@ObjectType("PurchaseApprovalOverview", {
  description: "As aprovações em números (os cards da página).",
})
export class PurchaseApprovalOverviewType {
  @Field(() => Int, { description: "Aguardando aprovação." })
  awaiting!: number;

  @Field(() => Int, { description: "Aprovadas neste mês (inclui na alçada)." })
  approvedThisMonth!: number;

  @Field(() => Int, { description: "Devolvidas para cotação neste mês." })
  returnedThisMonth!: number;

  @Field(() => Int, { description: "Reprovadas neste mês." })
  rejectedThisMonth!: number;
}
