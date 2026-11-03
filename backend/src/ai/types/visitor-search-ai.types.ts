import { z } from 'zod/v3';

export type VisitorSearchFilters = {
  intent: 'VISITOR_SEARCH';
  visitorName?: string | null;
  cnic?: string | null;
  houseNumber?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  latestOnly?: boolean | null;
  notExpiredOnly?: boolean | null;
};

export const VisitorSearchFiltersSchema = z.object({
  intent: z.literal('VISITOR_SEARCH'),
  visitorName: z.string().nullable(),
  cnic: z.string().nullable(),
  houseNumber: z.string().nullable(),
  fromDate: z.string().nullable(),
  toDate: z.string().nullable(),
  latestOnly: z.boolean().nullable(),
  notExpiredOnly: z.boolean().nullable(),
});
