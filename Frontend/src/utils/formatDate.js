export function formatDate(fecha) {
  if (!fecha) return "-";

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(fecha) {
  if (!fecha) return "-";

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateInput(fecha) {
  if (!fecha) return "";

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";

  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
