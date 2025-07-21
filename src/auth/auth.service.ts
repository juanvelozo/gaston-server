// src/auth/auth.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { User } from '@prisma/client';
import { JwtPayload } from './decorator/get-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
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

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return { user, tokens }; // Devuelve usuario y tokens para que el controlador establezca las cookies
  }

  async signin(dto: SigninDto) {
    const user: User | null = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Este usuario no se encuentra registrado.');

    const pwMatches = await bcrypt.compare(dto.password, user.hash);

    if (!pwMatches) throw new ForbiddenException('Credenciales incorrectas');

    const tokens = await this.getTokens(user?.id, user?.email);
    await this.updateRefreshTokenHash(user?.id, tokens.refresh_token);
    return { userId: user?.id, tokens }; // Devuelve userId y tokens para que el controlador establezca las cookies
  }

  async signToken(userId: number, email: string): Promise<{ access_token: string }> {
    const payload = { sub: userId, email };

    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '1m', // Caducidad corta para el access token
    });

    return { access_token: token };
  }

  async getTokens(userId: number, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '1m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '5m',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async updateRefreshTokenHash(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }

  async refreshTokens(refreshToken: string) {
    // <-- ¡userIdFromParam ELIMINADO!
    let userId: number;
    try {
      // Verificamos y decodificamos el refresh token.
      // Aunque el resultado pueda ser 'any' inicialmente, al verificar la propiedad 'sub'
      // y luego cast, el linter debería estar satisfecho.
      const decodedPayload: { sub: number } = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      // Validar que el payload decodificado sea un objeto y contenga 'sub'
      if (
        typeof decodedPayload === 'object' &&
        decodedPayload !== null &&
        'sub' in decodedPayload
      ) {
        // Usamos una aserción de tipo aquí para acceder a 'sub' de forma segura.
        // El warning 'no-unnecessary-type-assertion' debería desaparecer si el linter
        // entiende que `decodedPayload` no siempre es `JwtPayload` directamente.
        userId = (decodedPayload as JwtPayload).sub;
      } else {
        throw new ForbiddenException('Refresh token inválido: estructura de payload inesperada.');
      }
    } catch (e) {
      // Captura el error y tipifícalo como 'any' o 'unknown'
      // Puedes usar un logger aquí, si tienes uno configurado
      // Logger.error(e); // Si tienes Logger importado
      console.error('Error al verificar el refresh token:', e);
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Acceso denegado');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new ForbiddenException('Token inválido');

    const tokens = await this.getTokens(user.id, user.email);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    return tokens;
  }
  async logout(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logout exitoso' };
  }
}
