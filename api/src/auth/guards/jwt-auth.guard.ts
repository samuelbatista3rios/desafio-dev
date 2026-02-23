import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expirado. Faça login novamente.');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token inválido.');
      }
      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token ainda não é válido.');
      }
      if (!info || info?.message === 'No auth token') {
        throw new UnauthorizedException('Token não fornecido.');
      }
      throw err || new UnauthorizedException('Não autorizado.');
    }
    return user;
  }
}
