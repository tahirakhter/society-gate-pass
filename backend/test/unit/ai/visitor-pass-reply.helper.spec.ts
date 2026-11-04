import { extractExpectedVisitorPassFields } from '../../../src/ai/helpers/visitor-pass-reply.helper';

describe('visitor pass missing-field replies', () => {
  it.each([
    ['1234512345671', '12345-1234567-1'],
    ['12345 1234567 1', '12345-1234567-1'],
    ['CNIC is 12345-1234567-1', '12345-1234567-1'],
  ])('extracts and normalizes a CNIC reply: %s', (message, expected) => {
    expect(extractExpectedVisitorPassFields(message, ['cnic'])).toEqual({
      cnic: expected,
    });
  });

  it('uses the expected field to understand a bare house reply', () => {
    expect(extractExpectedVisitorPassFields('a-101', ['houseNumber'])).toEqual({
      houseNumber: 'A-101',
    });
  });

  it('does not treat a CNIC as a car number', () => {
    expect(
      extractExpectedVisitorPassFields('12345-1234567-1', ['carNumber']),
    ).toEqual({});
  });

  it('extracts multiple explicitly labeled fields', () => {
    expect(
      extractExpectedVisitorPassFields(
        'CNIC 1234512345671 and vehicle LEA 1234',
        ['cnic', 'carNumber'],
      ),
    ).toEqual({
      cnic: '12345-1234567-1',
      carNumber: 'LEA-1234',
    });
  });
});
