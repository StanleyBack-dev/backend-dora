import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import {
  type Dashboard,
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
}
