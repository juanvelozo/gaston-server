import {
  Body,
  Controller,
  Patch,
  Post,
  UseGuards,
  Res,
  Req,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { Public } from './decorator/public.decorator';
import { GetUser, JwtPayload } from './decorator/get-user.decorator';
import { ChangePasswordDto } from 'src/user/dto/change-password.dto';
import { UserService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import { JwtGuard } from './guard/jwt.guard';
import { getEnvironmentHeader } from 'src/utils/getEnvironmentFromHeaders';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Public()
  @Post('signup')
  async signup(
    @Req() req: Request,
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.authService.signup(dto);
    const environment = getEnvironmentHeader(req);
    const isProd = environment === 'prod';

    this.setCookies(res, tokens.access_token, tokens.refresh_token, isProd);
    return { user };
  }

  @Public()
  @Post('signin')
  async signin(
    @Req() req: Request,
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, tokens } = await this.authService.signin(dto);
    const environment = getEnvironmentHeader(req);
    const isProd = environment === 'prod';

    this.setCookies(res, tokens.access_token, tokens.refresh_token, isProd);
    return { userId };
  }

  @Public()
  @Post('refresh')
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as { [key: string]: string | undefined };
    const refreshToken = cookies['refresh_token'];
    const environment = getEnvironmentHeader(req);
    const isProd = environment === 'prod';

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ForbiddenException('Refresh token no proporcionado o inválido');
    }
    const tokens = await this.authService.refreshTokens(refreshToken); // Asume que el servicio extrae userId del token
    this.setCookies(res, tokens.access_token, tokens.refresh_token, isProd);
    return { message: 'Tokens refreshed successfully' }; // No devuelve tokens en el body
  }

  @Patch('change-password')
  changePassword(@GetUser('sub') userId: number, @Body() dto: ChangePasswordDto) {
    return this.userService.changePassword(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  async logout(@GetUser('sub') userId: number, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    this.clearCookies(res); // Limpia las cookies al cerrar sesión
    return { message: 'Logout exitoso' };
  }

  @UseGuards(JwtGuard)
  @Get('status')
  @HttpCode(HttpStatus.OK)
  checkAuthStatus(@Req() req: Request) {
    const userPayload = req.user as JwtPayload;
    return {
      isAuthenticated: true,
      userId: userPayload.sub,
      email: userPayload.email,
    };
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string, isProd: boolean) {
    // Cookie para el Access Token (vida corta)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: true, // `true` en producción (HTTPS), `false` para HTTP local
      sameSite: 'none', // Necesario para cross-origin, requiere `secure: true`
      expires: isProd ? new Date(Date.now() + 1 * 60 * 1000) : undefined, // Expira en 1 minuto
      path: '/', // Disponible en todo el dominio
    });

    // Cookie para el Refresh Token (vida larga)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true, // `true` en producción (HTTPS)
      sameSite: 'none', // Necesario para cross-origin, requiere `secure: true`
      expires: isProd ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined, // Expira en 30 días
      path: '/', // Disponible en todo el dominio
    });
  }

  private clearCookies(res: Response) {
    const cookieOptions = {
      httpOnly: true,
      // `secure` y `sameSite` deben coincidir con la forma en que se establecieron las cookies
      secure: true,
      sameSite: 'none' as const,
      path: '/', // También debe coincidir
    };
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }
}
