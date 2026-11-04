import type { VisitorPassCollectedData } from '../types/visitor-pass-ai.types';

type VisitorPassField = keyof VisitorPassCollectedData;

export function extractExpectedVisitorPassFields(
  message: string,
  missingFields: readonly string[],
): VisitorPassCollectedData {
  const expected = new Set(missingFields.filter(isVisitorPassField));
  const result: VisitorPassCollectedData = {};

  if (expected.has('cnic')) {
    const cnic = extractCnic(message);
    if (cnic) result.cnic = cnic;
  }

  if (expected.has('carNumber')) {
    const carNumber = extractCarNumber(message, expected.size === 1);
    if (carNumber) result.carNumber = carNumber;
  }

  if (expected.has('houseNumber')) {
    const houseNumber = extractLabeledValue(
      message,
      /\b(?:house|flat|apartment|villa|unit|home)(?:\s+number)?\s*[:#-]?\s*([a-z0-9][a-z0-9/-]*)\b/i,
      expected.size === 1,
    );
    if (houseNumber) result.houseNumber = houseNumber.toUpperCase();
  }

  if (expected.has('visitorName')) {
    const visitorName = extractLabeledValue(
      message,
      /\b(?:name|visitor|guest)(?:\s+is)?\s*[:#-]?\s*([\p{L}\p{M}][\p{L}\p{M} .'-]{1,80})$/iu,
      expected.size === 1,
    );
    if (visitorName) result.visitorName = visitorName;
  }

  return result;
}

function extractCnic(message: string): string | null {
  const match = message.match(/\b(\d{5})[-\s]?(\d{7})[-\s]?(\d)\b/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function extractCarNumber(
  message: string,
  allowBareReply: boolean,
): string | null {
  const labeled = message.match(
    /\b(?:car|vehicle|plate|registration)(?:\s+number)?\s*(?:is|:|#|-)?\s*([a-z]{1,4}[-\s]?\d{1,4})\b/i,
  )?.[1];
  const bare =
    allowBareReply && /^[a-z]{1,4}[-\s]?\d{1,4}$/i.test(message.trim())
      ? message.trim()
      : null;
  const value = labeled ?? bare;
  return value ? value.toUpperCase().replace(/\s+/g, '-') : null;
}

function extractLabeledValue(
  message: string,
  pattern: RegExp,
  allowBareReply: boolean,
): string | null {
  const labeled = message.match(pattern)?.[1]?.trim();
  if (labeled) return labeled;

  const bare = message.trim();
  return allowBareReply && bare.length >= 1 && bare.length <= 80 ? bare : null;
}

function isVisitorPassField(value: string): value is VisitorPassField {
  return [
    'visitorName',
    'cnic',
    'carNumber',
    'visitDateTime',
    'houseNumber',
  ].includes(value);
}
