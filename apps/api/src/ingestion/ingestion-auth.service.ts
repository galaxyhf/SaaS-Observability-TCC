import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcUnauthenticatedException } from '@nestjs/microservices';

import { hashProjectKey } from '../projects/project-key.crypto.js';
import { IngestionAuthRepository } from './ingestion-auth.repository.js';

export interface IngestionIdentity {
  keyId: string;
  projectId: string;
}

@Injectable()
export class IngestionAuthService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly repository: IngestionAuthRepository,
  ) {}

  public async authenticate(
    projectKey: string | undefined,
  ): Promise<IngestionIdentity> {
    if (
      !projectKey ||
      projectKey.length > 128 ||
      !projectKey.startsWith('obs_live_')
    ) {
      throw new GrpcUnauthenticatedException('Missing or invalid project key.');
    }

    const pepper = this.configService.getOrThrow<string>('PROJECT_KEY_PEPPER');
    const key = await this.repository.findActiveKey(
      hashProjectKey(projectKey, pepper),
    );

    if (!key) {
      throw new GrpcUnauthenticatedException('Missing or invalid project key.');
    }
    return key;
  }
}
