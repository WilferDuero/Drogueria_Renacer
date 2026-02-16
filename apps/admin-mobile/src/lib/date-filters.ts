const dateInputPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateInput = (value: string, endOfDay: boolean) => {
  const raw = String(value || "").trim();
  const match = dateInputPattern.exec(raw);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }

  const maxDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > maxDay) {
    return null;
  }

  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const sanitizeDateInput = (value: string) =>
  String(value || "").replace(/[^\d-]/g, "").slice(0, 10);

export const parseRecordDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const isSameLocalDay = (date: Date, now = new Date()) =>
  date.getFullYear() === now.getFullYear() &&
  date.getMonth() === now.getMonth() &&
  date.getDate() === now.getDate();

export const isInCurrentLocalMonth = (date: Date, now = new Date()) =>
  date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

export const isWithinLastNDays = (date: Date, days: number, now = new Date()) => {
  const safeDays = Number.isFinite(days) ? Math.max(Math.trunc(days), 1) : 1;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(todayStart);
  start.setDate(start.getDate() - (safeDays - 1));
  const end = new Date(todayStart);
  end.setDate(end.getDate() + 1);
  return date >= start && date < end;
};

export const isWithinDateRangeInput = (date: Date, fromInput: string, toInput: string) => {
  const from = parseDateInput(fromInput, false);
  const to = parseDateInput(toInput, true);
  if (from && date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
};
