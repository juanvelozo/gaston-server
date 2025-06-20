import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET, // o usando ConfigService luego
      signOptions: { expiresIn: '15m' },
    }),
    // otros módulos como ConfigModule, etc.
  ],

  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtStrategy],
})
export class AuthModule {}
