import { createHmac, randomBytes } from 'node:crypto';

const PRIVATE_KEY_PREFIX = 'obs_live_';
const PUBLIC_ID_PREFIX = 'obs_pub_';

export interface GeneratedProjectKey {
  key: string;
  keyHash: string;
  prefix: string;
}

export function hashProjectKey(key: string, pepper: string): string {
  return createHmac('sha256', pepper).update(key, 'utf8').digest('hex');
}

export function generateProjectKey(pepper: string): GeneratedProjectKey {
  const key = `${PRIVATE_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;

  return {
    key,
    keyHash: hashProjectKey(key, pepper),
    prefix: key.slice(0, PRIVATE_KEY_PREFIX.length + 8),
  };
}

export function generatePublicProjectId(): string {
  return `${PUBLIC_ID_PREFIX}${randomBytes(18).toString('base64url')}`;
}
