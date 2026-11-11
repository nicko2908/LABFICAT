const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const NUMERO = new Intl.NumberFormat("es-CO");

export function formatMoney(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? MONEDA.format(n) : "-";
}

export function formatNumber(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? NUMERO.format(n) : "-";
}
