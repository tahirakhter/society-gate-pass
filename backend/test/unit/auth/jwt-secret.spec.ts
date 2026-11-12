import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from '../../../src/auth/jwt-secret';

function config(values: Record<string, string | undefined>) {
  return new ConfigService(values);
}

describe('getJwtSecret', () => {
  it('returns the configured secret', () => {
    expect(
      getJwtSecret(
        config({ JWT_SECRET: 'real-secret', NODE_ENV: 'production' }),
      ),
    ).toBe('real-secret');
  });

  it('refuses to fall back to the public secret in production', () => {
    expect(() => getJwtSecret(config({ NODE_ENV: 'production' }))).toThrow(
      'JWT_SECRET must be set',
    );
  });

  it('falls back to the development secret outside production', () => {
    expect(getJwtSecret(config({ NODE_ENV: 'development' }))).toBe(
      'development-only-secret',
    );
  });
});
