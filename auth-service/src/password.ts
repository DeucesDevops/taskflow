import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, expected] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const hash = await derive(password, salt, 64) as Buffer;
  const expectedBytes = Buffer.from(expected, 'hex');
  return expectedBytes.length === hash.length && timingSafeEqual(expectedBytes, hash);
}
