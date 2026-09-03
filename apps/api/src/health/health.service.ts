import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  service: 'observability-api';
  status: 'ok';
}

@Injectable()
export class HealthService {
  public check(): HealthStatus {
    return {
      service: 'observability-api',
      status: 'ok',
    };
  }
}
