import { Module } from "@nestjs/common";
import { AdminQueueModule } from "./queue/admin-queue.module";

@Module({ imports: [AdminQueueModule] })
export class AdminModule {}
