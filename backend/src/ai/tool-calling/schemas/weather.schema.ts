import { z } from 'zod';

export const WEATHER_PERIODS = [
  'today',
  'tomorrow',
  'day_after_tomorrow',
  'week',
] as const;

export const weatherToolSchema = z
  .object({
    location: z.string().trim().min(2).max(100),
    period: z.enum(WEATHER_PERIODS),
  })
  .strict();

export type WeatherToolArgs = z.infer<typeof weatherToolSchema>;
