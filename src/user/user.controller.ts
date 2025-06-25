import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { GetUser } from '../auth/decorator/get-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@UseGuards(JwtGuard)
@Controller('user')
export class UserController {
  constructor(
    private service: UserService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('profile')
  getProfile(@GetUser('sub') userId: number) {
    return this.service.getProfile(userId);
  }

  @Patch('profile')
  @UseInterceptors(FileInterceptor('file'))
  async updateProfile(
    @GetUser('sub') userId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProfileDto,
  ) {
    let imageUrl: string | undefined;

    if (file) {
      const uploaded = await this.cloudinaryService.uploadImage(file);
      imageUrl = uploaded.secure_url;
    }

    const updatedDto = {
      ...dto,
      ...(imageUrl && { profileImage: imageUrl }),
    };

    return this.service.updateProfile(userId, updatedDto);
  }

  @Patch('change-password')
  changePassword(@GetUser('sub') userId: number, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(userId, dto);
  }
}
