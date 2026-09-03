import { PasswordService } from '../src/security/password.service.js';

describe('PasswordService', () => {
  const passwordService = new PasswordService();

  it('stores passwords with Argon2id and verifies the correct value', async () => {
    const password = 'a-secure-password-for-testing';
    const passwordHash = await passwordService.hash(password);

    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    await expect(passwordService.verify(passwordHash, password)).resolves.toBe(
      true,
    );
    await expect(
      passwordService.verify(passwordHash, 'incorrect-password'),
    ).resolves.toBe(false);
  });
});
