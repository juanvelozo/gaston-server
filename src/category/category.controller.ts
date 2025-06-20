import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { GetUser } from 'src/auth/decorator/get-user.decorator';

@Controller('categories')
@UseGuards(JwtGuard)
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  @Post()
  create(@GetUser('sub') userId: number, @Body() dto: CreateCategoryDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  findAll(@GetUser('sub') userId: number) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  findOne(@GetUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @GetUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@GetUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(userId, id);
  }
}
