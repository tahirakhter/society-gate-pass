import { z } from 'zod/v3';
import type { AI_PASS_STATUS } from '../constants/ai.constants';

export type VisitorPassCollectedData = {
  visitorName?: string;
  cnic?: string;
  carNumber?: string;
  visitDateTime?: string;
  houseNumber?: string;
};

export type CompleteVisitorPassCollectedData =
  Required<VisitorPassCollectedData>;

export const VisitorPassSchema = z.object({
  visitorName: z.string().nullable(),
  cnic: z.string().nullable(),
  carNumber: z.string().nullable(),
  houseNumber: z.string().nullable(),
  visitDateTime: z.string().nullable(),
  missingFields: z.array(z.string()),
});

export type VisitorPassExtraction = z.infer<typeof VisitorPassSchema>;

export const REQUIRED_VISITOR_PASS_FIELDS: Array<
  keyof VisitorPassCollectedData
> = ['visitorName', 'cnic', 'carNumber', 'visitDateTime', 'houseNumber'];

export type AiPassStatus = (typeof AI_PASS_STATUS)[keyof typeof AI_PASS_STATUS];
