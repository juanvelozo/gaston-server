// src/auth/auth.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Método para registrar un nuevo usuario.
   * @param dto - Data Transfer Object que contiene la información de registro.
   * @throws ForbiddenException - Si el email ya está registrado.
   * @returns Un objeto que contiene el token de acceso.
   */
  async signup(dto: SignupDto) {
    // Verificar si el usuario ya existe.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ForbiddenException('El email ya está registrado');
    }

    // Hashear la contraseña del usuario.
    const hash = await bcrypt.hash(dto.password, 10);

    // Crear un nuevo usuario en la base de datos.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        hash,
        fullName: dto.fullName,
      },
    });

    // Retornar el token de acceso.
    return this.signToken(user.id, user.email);
  }

  /**
   * Método para autenticar un usuario existente.
   * @param dto - Data Transfer Object que contiene la información de inicio de sesión.
   * @throws ForbiddenException - Si las credenciales son incorrectas.
   * @returns Un objeto que contiene el token de acceso.
   */
  async signin(dto: SigninDto) {
    // Buscar al usuario por su email.
    const user: User | null = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Verificar si el usuario existe y las credenciales son correctas.
    if (!user || !(await bcrypt.compare(dto.password, user.hash)))
      throw new ForbiddenException('Credenciales incorrectas');

    // Comprobar si la contraseña coincide con el hash almacenado.
    const pwMatches = await bcrypt.compare(dto.password, user.hash);

    if (!pwMatches) throw new ForbiddenException('Credenciales incorrectas');

    // Retornar el token de acceso.
    return this.signToken(user.id, user.email);
  }

  /**
   * Método para firmar un token JWT.
   * @param userId - ID del usuario.
   * @param email - Email del usuario.
   * @returns Un objeto que contiene el token de acceso.
   */
  async signToken(userId: number, email: string): Promise<{ access_token: string }> {
    // Crear el payload del JWT.
    const payload = { sub: userId, email };

    // Firmar el token JWT.
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '15m',
    });

    // Retornar el token de acceso.
    return { access_token: token };
  }
}
