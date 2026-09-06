import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException({ error: { code: "UNAUTHORIZED", message: "Giriş gerekli" } });
    if (!requiredRoles.includes(user.role)) throw new ForbiddenException({ error: { code: "FORBIDDEN", message: "Yetkiniz yok" } });
    return true;
  }
}
