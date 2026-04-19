import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { User } from '@prisma/client';
import { JwtPayload } from './decorator/get-user.decorator';
import { TokensService } from './tokens.service';
import { ChangePasswordDto } from '../user/dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private tokensService: TokensService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ForbiddenException('El email ya está registrado');
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hash,
        fullName: dto.fullName,
      },
    });

    const tokens = await this.tokensService.getTokens(user.id, user.email);
    await this.tokensService.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return { user, tokens };
  }

  async signin(dto: SigninDto) {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Este usuario no se encuentra registrado.');

    const pwMatches = await bcrypt.compare(dto.password, user.hash);

    if (!pwMatches) throw new ForbiddenException('Credenciales incorrectas');

    const tokens = await this.tokensService.getTokens(user.id, user.email);
    await this.tokensService.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return { userId: user.id, tokens };
  }

  async signToken(userId: number, email: string): Promise<{ access_token: string }> {
    const payload = { sub: userId, email };

    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '1m',
    });

    return { access_token: token };
  }

  async refreshTokens(refreshToken: string) {
    let userId: number;
    try {
      const decodedPayload: { sub: number } = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      if (
        typeof decodedPayload === 'object' &&
        decodedPayload !== null &&
        'sub' in decodedPayload
      ) {
        userId = (decodedPayload as JwtPayload).sub;
      } else {
        throw new ForbiddenException('Refresh token inválido: estructura de payload inesperada.');
      }
    } catch (e) {
      console.error('Error al verificar el refresh token:', e);
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Acceso denegado');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new ForbiddenException('Token inválido');

    const tokens = await this.tokensService.getTokens(user.id, user.email);
    await this.tokensService.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logout exitoso' };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    const pwMatches = await bcrypt.compare(dto.currentPassword, user.hash);
    if (!pwMatches) {
      throw new ForbiddenException('Contraseña actual incorrecta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { hash: newHash },
    });

    const tokens = await this.tokensService.getTokens(user.id, user.email);
    await this.tokensService.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }
}
