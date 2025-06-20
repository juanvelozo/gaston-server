import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../decorator/get-user.decorator';

/**
 * Estrategia para manejar la autenticación JWT.
 * Utiliza la estrategia de Passport para validar tokens JWT.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  /**
   * Constructor de JwtStrategy.
   * @param config - Servicio de configuración para obtener variables de entorno.
   * @throws Error si JWT_SECRET no está definido en las variables de entorno.
   */
  constructor(config: ConfigService) {
    // Obtiene el secreto de JWT desde las variables de entorno.
    const jwtSecret = config.get<string>('JWT_SECRET');

    // Verifica si JWT_SECRET está definido.
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    // Configura la estrategia de Passport para extraer el token desde el encabezado de autorización.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Valida el payload del JWT.
   * @param payload - Contenido del JWT.
   * @returns El payload, que será accesible desde req.user.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload; // será accesible desde req.user
  }
}
