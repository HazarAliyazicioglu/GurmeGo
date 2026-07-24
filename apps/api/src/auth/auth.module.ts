import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthMiddleware } from "./jwt-auth.middleware";
import { RolesGuard } from "./roles.guard";

@Module({
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(JwtAuthMiddleware).forRoutes("*");
  }
}
