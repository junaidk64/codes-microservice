import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const expectedToken = this.configService.get<string>('CODES_SERVICE_TOKEN');

    if (!expectedToken) {
      throw new UnauthorizedException('Service token is not configured');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.slice('Bearer '.length);
    if (token !== expectedToken) {
      throw new UnauthorizedException('Invalid authorization token');
    }

    return true;
  }
}
