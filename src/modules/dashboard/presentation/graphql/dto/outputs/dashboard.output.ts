import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import {
  type Dashboard,
  type LostFoundIndicators,
  type ParcelIndicators,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";

@ObjectType("ParcelMonth", { description: "Encomendas de um mês." })
export class ParcelMonthType {
  @Field({ description: "AAAA-MM, no fuso do condomínio." })
  month!: string;

  @Field(() => Int, { description: "Recebidas no mês." })
  received!: number;

  @Field(() => Int, { description: "Dessas, as já retiradas." })
  pickedUp!: number;
}

@ObjectType("ParcelIndicators", {
  description: "Indicadores das encomendas do condomínio.",
})
export class ParcelIndicatorsType implements ParcelIndicators {
  @Field(() => Int, { description: "Aguardando retirada agora." })
  waiting!: number;

  @Field(() => Int, { description: "Aguardando há mais de 3 dias." })
  stuck!: number;

  @Field(() => Int, { description: "Perecíveis com o prazo vencido." })
  perishableOverdue!: number;

  @Field(() => Int, { description: "Retiradas nos últimos 30 dias." })
  pickedUpLast30Days!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      "Tempo médio até a retirada (horas), nos últimos 30 dias (nulo: nenhuma retirada).",
  })
  averagePickupHours!: number | null;

  @Field(() => [ParcelMonthType], {
    description: "Os últimos 6 meses, do mais antigo ao atual.",
  })
  monthly!: ParcelMonthType[];
}

@ObjectType("FoundItemMonth", { description: "Itens achados de um mês." })
export class FoundItemMonthType {
  @Field({ description: "AAAA-MM, no fuso do condomínio." })
  month!: string;

  @Field(() => Int, { description: "Achados no mês." })
  found!: number;

  @Field(() => Int, { description: "Desses, os já devolvidos ao dono." })
  returned!: number;
}

@ObjectType("LostFoundIndicators", {
  description: "Indicadores dos achados e perdidos do condomínio.",
})
export class LostFoundIndicatorsType implements LostFoundIndicators {
  @Field(() => Int, { description: "Itens guardados agora." })
  kept!: number;

  @Field(() => Int, { description: "Pedidos aguardando conferência." })
  pendingClaims!: number;

  @Field(() => Int, {
    description: "Guardados com o prazo acabando em até 7 dias.",
  })
  expiringSoon!: number;

  @Field(() => Int, { description: 'Avisos de "Perdi algo" abertos.' })
  openLostReports!: number;

  @Field(() => Int, { description: "Devolvidos nos últimos 90 dias." })
  returnedLast90Days!: number;

  @Field(() => Int, {
    nullable: true,
    description:
      "Dos itens que saíram nos últimos 90 dias, a porcentagem devolvida ao dono (nulo: nenhum saiu).",
  })
  returnRate!: number | null;

  @Field(() => [FoundItemMonthType], {
    description: "Os últimos 6 meses, do mais antigo ao atual.",
  })
  monthly!: FoundItemMonthType[];
}

@ObjectType("Dashboard", { description: "Painel do gestor do condomínio." })
export class DashboardType implements Dashboard {
  @Field(() => Int, {
    description: "Moradores com acesso ativo (sem a equipe).",
  })
  activeUsers!: number;

  @Field(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollments!: number;

  @Field(() => Int, { description: "Unidades cadastradas." })
  units!: number;

  @Field(() => Int, { description: "Espaços ativos para reserva." })
  activeSpaces!: number;

  @Field(() => Int, { description: "Reservas aguardando aprovação." })
  pendingBookings!: number;

  @Field(() => Int, { description: "Reservas ativas que começam hoje." })
  bookingsToday!: number;

  @Field(() => Int, {
    nullable: true,
    description: "Pedidos de suporte sem resposta (só a plataforma vê).",
  })
  openSupportRequests!: number | null;

  @Field(() => Int, {
    nullable: true,
    description: "Notificações que falharam de vez (só a plataforma vê).",
  })
  failedNotifications!: number | null;

  @Field(() => ParcelIndicatorsType, {
    nullable: true,
    description: "Encomendas (nulo: módulo desligado).",
  })
  parcels!: ParcelIndicatorsType | null;

  @Field(() => LostFoundIndicatorsType, {
    nullable: true,
    description: "Achados e perdidos (nulo: módulo desligado).",
  })
  lostAndFound!: LostFoundIndicatorsType | null;
}
