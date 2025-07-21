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

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.signup(dto);
    this.setCookies(res, tokens.access_token, tokens.refresh_token);
    return { user };
  }

  @Public()
  @Post('signin')
  async signin(@Body() dto: SigninDto, @Res({ passthrough: true }) res: Response) {
    const { userId, tokens } = await this.authService.signin(dto);
    this.setCookies(res, tokens.access_token, tokens.refresh_token);
    return { userId };
  }

  @Public()
  @Post('refresh')
  async refreshTokens(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    console.log('cookies', req.cookies);

    const cookies = req.cookies as { [key: string]: string | undefined };
    const refreshToken = cookies['refresh_token'];

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ForbiddenException('Refresh token no proporcionado o inválido');
    }
    const tokens = await this.authService.refreshTokens(refreshToken); // Asume que el servicio extrae userId del token
    this.setCookies(res, tokens.access_token, tokens.refresh_token);
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

  // Método para establecer cookies
  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(Date.now() + 1 * 60 * 1000), // 1 minuto
      priority: 'high',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(Date.now() + 5 * 60 * 2000), // 10 minutos
      priority: 'high',
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }
}
