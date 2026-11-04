import type { WeatherToolArgs } from '../schemas/weather.schema';

const PERIOD_WORDS =
  /\b(?:right\s+now|currently|today|tonight|tomorrow|the\s+day\s+after\s+tomorrow|day\s+after\s+tomorrow|this\s+week|next\s+week|(?:for\s+the\s+)?next\s+7\s+days)\b/gi;
const WEATHER_WORDS =
  /\b(?:weather|forecast|temperature|humidity|climate|rain(?:ing)?)\b/gi;
const LOCATION_PREFIX =
  /^(?:(?:(?:city|weather)\s+of|in|at|for|around|of)\s+)+/i;

export function parseWeatherQuery(message: string): Partial<WeatherToolArgs> {
  const period = extractWeatherPeriod(message);
  const location = extractWeatherLocation(message);

  return location ? { location, period } : { period };
}

export function extractWeatherPeriod(
  message: string,
): WeatherToolArgs['period'] {
  const normalized = message.toLowerCase();

  if (normalized.includes('day after tomorrow')) {
    return 'day_after_tomorrow';
  }

  if (normalized.includes('tomorrow')) {
    return 'tomorrow';
  }

  if (
    /\b(?:this week|next week|week|next\s+7(?:\s+days)?)\b/.test(normalized)
  ) {
    return 'week';
  }

  return 'today';
}

export function extractWeatherLocation(message: string): string | null {
  const normalized = message
    .trim()
    .replace(/[?.!]+$/g, '')
    .replace(WEATHER_WORDS, ' ')
    .replace(PERIOD_WORDS, ' ')
    .replace(/\b(?:what|is|the|show|me|how|will|it|be|like)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LOCATION_PREFIX, '')
    .replace(/\s+(?:(?:city|weather)\s+of|in|at|for|around|of)\s+/gi, ' ')
    .replace(/^(?:(?:city|weather)\s+of|in|at|for|around|of)$/i, '')
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '');

  if (!normalized || isPeriodOnly(normalized)) {
    return null;
  }

  if (!/^[\p{L}\p{M}][\p{L}\p{M}\s,.'’-]{1,99}$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function isPeriodOnly(value: string): boolean {
  return /^(?:right now|currently|today|tonight|tomorrow|(?:the )?day after tomorrow|this week|next week|week|next 7(?: days)?)$/i.test(
    value,
  );
}
