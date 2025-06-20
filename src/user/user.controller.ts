import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { GetUser } from '../auth/decorator/get-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(private service: UserService) {}

  @Get('profile')
  getProfile(@GetUser('sub') userId: number) {
    return this.service.getProfile(userId);
  }

  @Patch('profile')
  updateProfile(@GetUser('sub') userId: number, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(userId, dto);
  }
  @Patch('change-password')
  changePassword(@GetUser('sub') userId: number, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(userId, dto);
  }
}
