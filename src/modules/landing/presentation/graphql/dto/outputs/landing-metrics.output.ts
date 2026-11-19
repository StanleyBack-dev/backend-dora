import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("LandingRank", {
  description: "Uma linha de ranking: ocorrências e visitantes distintos.",
})
export class LandingRankType {
  @Field()
  name!: string;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  visitors!: number;
}

@ObjectType("LandingTotals")
export class LandingTotalsType {
  @Field(() => Int, { description: "Visitantes únicos." })
  visitors!: number;

  @Field(() => Int)
  sessions!: number;

  @Field(() => Int)
  pageViews!: number;

  @Field(() => Int, { description: "Mensagens recebidas pelo formulário." })
  leads!: number;

  @Field(() => Int, {
    description: "Cliques em WhatsApp, e-mail e redes sociais.",
  })
  contactClicks!: number;

  @Field(() => Int)
  videoPlays!: number;

  @Field(() => Int, { description: "Sessões que começaram o formulário." })
  formStarts!: number;

  @Field(() => Int)
  formSuccesses!: number;
}

@ObjectType("LandingDay")
export class LandingDayType {
  @Field({ description: "YYYY-MM-DD" })
  day!: string;

  @Field(() => Int)
  visitors!: number;

  @Field(() => Int)
  leads!: number;
}

@ObjectType("LandingMetrics", {
  description: "Tráfego e conversão da landing page no período.",
})
export class LandingMetricsType {
  @Field(() => Int)
  days!: number;

  @Field(() => LandingTotalsType)
  totals!: LandingTotalsType;

  @Field(() => [LandingDayType])
  daily!: LandingDayType[];

  @Field(() => [LandingRankType])
  pages!: LandingRankType[];

  @Field(() => [LandingRankType])
  sections!: LandingRankType[];

  @Field(() => [LandingRankType])
  clicks!: LandingRankType[];

  @Field(() => [LandingRankType])
  contacts!: LandingRankType[];

  @Field(() => [LandingRankType])
  videos!: LandingRankType[];

  @Field(() => [LandingRankType])
  scrollDepth!: LandingRankType[];

  @Field(() => [LandingRankType])
  referrers!: LandingRankType[];

  @Field(() => [LandingRankType])
  campaigns!: LandingRankType[];

  @Field(() => [LandingRankType])
  devices!: LandingRankType[];

  @Field(() => [LandingRankType])
  leadSubjects!: LandingRankType[];
}
