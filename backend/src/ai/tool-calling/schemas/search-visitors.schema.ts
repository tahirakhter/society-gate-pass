import { z } from 'zod';

export const searchVisitorsToolSchema = z
  .object({
    visitorName: z.string().nullable(),
    cnic: z.string().nullable(),
    carNumber: z.string().nullable(),
    houseNumber: z.string().nullable(),
    fromDate: z.string().nullable(),
    toDate: z.string().nullable(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'USED']).nullable(),
    limit: z.number().int().min(1).max(20),
  })
  .strict();

export type SearchVisitorsToolArgs = z.infer<typeof searchVisitorsToolSchema>;
