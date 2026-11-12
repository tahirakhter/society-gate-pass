import { ConfigService } from '@nestjs/config';

const DEVELOPMENT_FALLBACK_SECRET = 'development-only-secret';

/**
 * Resolve the JWT signing secret. Outside production a fixed fallback keeps
 * local setup simple; in production a missing secret is a fatal
 * misconfiguration, since a public fallback would let anyone forge tokens.
 */
export function getJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');

  if (secret) {
    return secret;
  }

  if (configService.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }

  return DEVELOPMENT_FALLBACK_SECRET;
}
