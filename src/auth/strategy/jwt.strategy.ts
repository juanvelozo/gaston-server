import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../decorator/get-user.decorator';
import { Request } from 'express'; // Importar Request para acceder a las cookies

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
    const jwtSecret = config.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }

    super({
      jwtFromRequest: (req: Request) => {
        if (req && req.cookies && typeof req.cookies === 'object') {
          const cookies = req.cookies as { [key: string]: string | undefined };
          const accessToken = cookies['access_token'];
          if (typeof accessToken === 'string' && accessToken.length > 0) {
            return accessToken;
          }
        }
        return null;
      },
      ignoreExpiration: false,
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
