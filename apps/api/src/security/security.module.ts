import { Global, Module } from '@nestjs/common';

import { PasswordService } from './password.service.js';

@Global()
@Module({
  exports: [PasswordService],
  providers: [PasswordService],
})
export class SecurityModule {}
