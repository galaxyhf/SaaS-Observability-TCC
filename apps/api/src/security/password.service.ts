import { Injectable } from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';

@Injectable()
export class PasswordService {
  public hash(value: string): Promise<string> {
    return hash(value, {
      hashLength: 32,
      memoryCost: 19_456,
      parallelism: 1,
      timeCost: 2,
      type: argon2id,
    });
  }

  public verify(hashValue: string, candidate: string): Promise<boolean> {
    return verify(hashValue, candidate);
  }
}
