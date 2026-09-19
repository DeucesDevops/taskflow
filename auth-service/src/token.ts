import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

export const SESSION_SECONDS = 24 * 60 * 60;
const issuer = 'taskflow-auth';
const audience = 'taskflow';

export function createTokens(secret: string) {
  const key = new TextEncoder().encode(secret);
  if (key.byteLength < 32) throw new Error('JWT_SECRET must contain at least 32 UTF-8 bytes');
  return {
    async sign(userId: string): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(userId).setJti(randomUUID()).setIssuer(issuer).setAudience(audience)
        .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(key);
    },
    async subject(token: string): Promise<string | null> {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'], issuer, audience, typ: 'JWT',
          requiredClaims: ['sub', 'jti', 'iat', 'exp'], maxTokenAge: `${SESSION_SECONDS}s`,
        });
        return typeof payload.sub === 'string' && typeof payload.jti === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}
