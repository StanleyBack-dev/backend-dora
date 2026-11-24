/** "R$ 1.234,56" from cents. */
export const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
