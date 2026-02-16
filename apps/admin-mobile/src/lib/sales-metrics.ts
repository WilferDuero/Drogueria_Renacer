import { Sale } from "../types/domain";

export interface SalesRevenueSummary {
  today: number;
  month: number;
  year: number;
}

const toValidDate = (raw?: string) => {
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const computeSalesRevenueSummary = (sales: Sale[]): SalesRevenueSummary => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  return sales.reduce<SalesRevenueSummary>(
    (summary, sale) => {
      const total = Number(sale.total) || 0;
      const date = toValidDate(sale.fechaISO || sale.createdAt);

      if (!date) {
        return summary;
      }

      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      if (year === currentYear) {
        summary.year += total;
        if (month === currentMonth) {
          summary.month += total;
          if (day === currentDay) {
            summary.today += total;
          }
        }
      }
      return summary;
    },
    { today: 0, month: 0, year: 0 }
  );
};
