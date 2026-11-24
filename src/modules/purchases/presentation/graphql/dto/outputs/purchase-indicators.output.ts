import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { Category } from "@/modules/catalog/domain/category";
import "@/modules/purchases/presentation/graphql/purchases.graphql-enums";

@ObjectType("IndicatorPeriod")
export class IndicatorPeriodType {
  @Field(() => Int)
  year!: number;

  @Field(() => Int, { nullable: true })
  month!: number | null;
}

@ObjectType("CategorySpend", { description: "Pago numa categoria." })
export class CategorySpendType {
  @Field(() => Category)
  category!: Category;

  @Field(() => Float)
  cents!: number;

  @Field(() => Int)
  purchases!: number;
}

@ObjectType("MonthSpend", { description: "Pago num mês do ano." })
export class MonthSpendType {
  @Field(() => Int)
  month!: number;

  @Field(() => Float)
  cents!: number;
}

@ObjectType("SupplierSpend", { description: "Pago a um fornecedor." })
export class SupplierSpendType {
  @Field(() => ID, { nullable: true })
  supplierId!: string | null;

  @Field()
  supplierName!: string;

  @Field(() => Float)
  cents!: number;

  @Field(() => Int)
  purchases!: number;

  @Field(() => Float, { nullable: true })
  ratingAverage!: number | null;

  @Field(() => Int)
  ratingCount!: number;
}

@ObjectType("CommittedSpend", {
  description: "O que os pedidos feitos ainda devem (hoje).",
})
export class CommittedSpendType {
  @Field(() => Float)
  cents!: number;

  @Field(() => Int)
  installments!: number;

  @Field(() => Int)
  orders!: number;
}

@ObjectType("ProcessIndicators", {
  description: "Como foram os pedidos feitos no período.",
})
export class ProcessIndicatorsType {
  @Field(() => Int)
  orders!: number;

  @Field(() => Float, {
    description: "Maior cotação completa menos a escolhida, somadas.",
  })
  savingsCents!: number;

  @Field(() => Int)
  withThreeQuotes!: number;

  @Field(() => Float, { nullable: true })
  avgDaysToOrder!: number | null;

  @Field(() => Float, { nullable: true })
  avgDaysToDeliver!: number | null;

  @Field(() => Int)
  lateDeliveries!: number;
}

@ObjectType("PurchaseIndicators", {
  description: "As compras em números para a gestão.",
})
export class PurchaseIndicatorsType {
  @Field(() => IndicatorPeriodType)
  period!: IndicatorPeriodType;

  @Field(() => Float)
  paidCents!: number;

  @Field(() => Int)
  paidInstallments!: number;

  @Field(() => Int)
  purchases!: number;

  @Field(() => CommittedSpendType)
  committed!: CommittedSpendType;

  @Field(() => [CategorySpendType])
  byCategory!: CategorySpendType[];

  @Field(() => [MonthSpendType])
  byMonth!: MonthSpendType[];

  @Field(() => [SupplierSpendType])
  bySupplier!: SupplierSpendType[];

  @Field(() => ProcessIndicatorsType)
  process!: ProcessIndicatorsType;
}

@ObjectType("TransparencyStatus", {
  description: "Se a prestação de contas está publicada aos moradores.",
})
export class TransparencyStatusType {
  @Field()
  enabled!: boolean;

  @Field(() => Date, { nullable: true })
  updatedAt!: Date | null;

  @Field(() => String, { nullable: true })
  updatedByName!: string | null;

  @Field({ description: "Publica ou retira (aprovadores)." })
  canManage!: boolean;

  @Field({ description: "Vê mesmo sem publicar (gestão e aprovadores)." })
  canPreview!: boolean;
}

@ObjectType("TransparencySummary", {
  description: "A prestação de contas de um período.",
})
export class TransparencySummaryType {
  @Field(() => IndicatorPeriodType)
  period!: IndicatorPeriodType;

  @Field(() => Float)
  paidCents!: number;

  @Field(() => Int)
  purchases!: number;

  @Field(() => [CategorySpendType])
  byCategory!: CategorySpendType[];

  @Field(() => [MonthSpendType])
  byMonth!: MonthSpendType[];
}

@ObjectType("TransparencyPurchase", {
  description: "Uma compra concluída, como o morador vê.",
})
export class TransparencyPurchaseType {
  @Field(() => Int)
  number!: number;

  @Field()
  title!: string;

  @Field(() => [Category])
  categories!: Category[];

  @Field(() => String, { nullable: true })
  categoryOther!: string | null;

  @Field()
  supplierName!: string;

  @Field(() => Float)
  totalCents!: number;

  @Field({ description: "YYYY-MM-DD" })
  completedOn!: string;

  @Field(() => Int)
  quoteCount!: number;
}

export const TransparencyPurchasePage = Paginated(
  TransparencyPurchaseType,
  "TransparencyPurchasePage",
);

@ObjectType("PurchaseReportFile", {
  description:
    "Relatório de compras em PDF (indicadores ou prestação de contas).",
})
export class PurchaseReportFileType {
  @Field({ description: "Nome sugerido do arquivo." })
  fileName!: string;

  @Field({ description: "application/pdf" })
  mimeType!: string;

  @Field({ description: "O PDF em base64." })
  base64Content!: string;
}
