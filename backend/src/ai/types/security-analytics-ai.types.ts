import { z } from 'zod/v3';

export const SECURITY_ANALYTICS_TYPES = [
  'SUSPICIOUS_ACTIVITY',
  'FREQUENT_VISITORS',
  'HOUSE_VISITOR_COUNTS',
  'REPEATED_CNICS',
  'REPEATED_CAR_NUMBERS',
  'EXPIRED_PASS_USAGE',
  'FAILED_SCANS',
  'SUMMARY',
  'UNKNOWN',
] as const;

export const SecurityAnalyticsFiltersSchema = z.object({
  intent: z.literal('SECURITY_ANALYTICS'),
  analyticsType: z.enum(SECURITY_ANALYTICS_TYPES),
  houseNumber: z.string().nullable().optional(),
  visitorName: z.string().nullable().optional(),
  cnic: z.string().nullable().optional(),
  carNumber: z.string().nullable().optional(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
});

export type SecurityAnalyticsFilters = z.infer<
  typeof SecurityAnalyticsFiltersSchema
>;
