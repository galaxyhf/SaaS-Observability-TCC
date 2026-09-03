import {
  generateProjectKey,
  generatePublicProjectId,
  hashProjectKey,
} from '../src/projects/project-key.crypto.js';

describe('Project Key cryptography', () => {
  const pepper = 'test-project-key-pepper-with-at-least-32-characters';

  it('creates a private key and stores only its deterministic HMAC', () => {
    const generated = generateProjectKey(pepper);

    expect(generated.key.startsWith('obs_live_')).toBe(true);
    expect(generated.prefix.startsWith('obs_live_')).toBe(true);
    expect(generated.keyHash).toHaveLength(64);
    expect(generated.keyHash).toBe(hashProjectKey(generated.key, pepper));
    expect(generated.keyHash).not.toContain(generated.key);
  });

  it('creates non-secret browser project identifiers separately', () => {
    expect(generatePublicProjectId().startsWith('obs_pub_')).toBe(true);
  });
});
