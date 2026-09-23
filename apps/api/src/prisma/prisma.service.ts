import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    // `pg.Pool` falls back to PGHOST/PGUSER/PGDATABASE/... (or a local Unix socket) when
    // `connectionString` is undefined, instead of failing -- a missing DATABASE_URL would
    // otherwise let this connect to WHATEVER Postgres happens to be reachable on the host
    // (a stray local instance, ambient PG* env vars from an unrelated process) rather than
    // erroring, cross-model review finding.
    if (!connectionString) throw new Error("DATABASE_URL is required");
    super({
      adapter: new PrismaPg({
        connectionString,
        // Fail fast instead of queuing indefinitely (pg's own default is 0 = no timeout) --
        // cross-model review finding: an unreachable/overloaded DB would otherwise let requests
        // pile up on the pool forever instead of surfacing as a clear, timely error.
        connectionTimeoutMillis: 10_000,
      }),
    });
  }

  async onModuleInit() {
    // `$connect()` alone no longer proves connectivity: Prisma 7's driver-adapter pool is created
    // lazily and only opens a real connection on the first query (cross-model review finding,
    // verified empirically -- the compiled app booted and served 200s from /health against a
    // completely unreachable DATABASE_URL). A trivial query forces that first real connection
    // during startup, so an unreachable database fails the boot instead of serving traffic.
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
