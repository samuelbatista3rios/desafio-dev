import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Categorias')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar categoria' })
  @ApiResponse({ status: 201, description: 'Categoria criada com sucesso' })
  create(
    @CurrentUser() user: { id: string },
    @Body() createCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(user.id, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorias do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de categorias' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.categoriesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar categoria por ID' })
  @ApiResponse({ status: 200, description: 'Dados da categoria' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.categoriesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar categoria' })
  @ApiResponse({ status: 200, description: 'Categoria atualizada' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, user.id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover categoria' })
  @ApiResponse({ status: 200, description: 'Categoria removida' })
  @ApiResponse({ status: 404, description: 'Categoria não encontrada' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.categoriesService.remove(id, user.id);
  }
}
