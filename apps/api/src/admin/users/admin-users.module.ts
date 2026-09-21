import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { RateLimitModule } from "../../common/rate-limit.module";

@Module({ imports: [RateLimitModule], controllers: [AdminUsersController], providers: [AdminUsersService] })
export class AdminUsersModule {}
