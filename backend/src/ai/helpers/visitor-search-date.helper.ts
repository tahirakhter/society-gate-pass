export type VisitorSearchDateRange = {
  fromDate: string;
  toDate: string | null;
};

const MONTH_NAMES: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

export function extractVisitorSearchDateRange(
  message: string,
): VisitorSearchDateRange | null {
  const isOpenEnded = /\b(onwards?|onward|since|from|after|starting)\b/i.test(
    message,
  );
  const numericMatch = message.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);

  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    const isoDate = toIsoDate(year, month, day);

    return {
      fromDate: isoDate,
      toDate: isOpenEnded ? null : isoDate,
    };
  }

  const monthNameDate = extractMonthNameDate(message);

  if (monthNameDate) {
    return {
      fromDate: monthNameDate,
      toDate: isOpenEnded ? null : monthNameDate,
    };
  }

  return null;
}

function extractMonthNameDate(message: string): string | null {
  const dayMonthMatch = message.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*([a-zA-Z]+)(?:\s+(\d{4}))?\b/,
  );

  if (dayMonthMatch) {
    const [, day, monthName, year] = dayMonthMatch;
    const month = MONTH_NAMES[monthName.toLowerCase()];

    if (month) {
      return toIsoDate(year ?? getCurrentYear(), month, day);
    }
  }

  const monthDayMatch = message.match(
    /\b([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/,
  );

  if (monthDayMatch) {
    const [, monthName, day, year] = monthDayMatch;
    const month = MONTH_NAMES[monthName.toLowerCase()];

    if (month) {
      return toIsoDate(year ?? getCurrentYear(), month, day);
    }
  }

  return null;
}

function getCurrentYear(): string {
  return new Date().getFullYear().toString();
}

function toIsoDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
