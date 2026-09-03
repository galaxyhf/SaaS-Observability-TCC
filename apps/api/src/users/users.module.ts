import { Module } from '@nestjs/common';

import { UsersRepository } from './users.repository.js';

@Module({
  exports: [UsersRepository],
  providers: [UsersRepository],
})
export class UsersModule {}
