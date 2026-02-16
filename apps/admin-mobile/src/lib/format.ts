export const formatCurrencyCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatDateTime = (isoDate?: string) => {
  if (!isoDate) {
    return "--";
  }
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    return "--";
  }
  return d.toLocaleString("es-CO");
};

export const toNumber = (raw: string, fallback = 0) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toInteger = (raw: string, fallback = 0) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

