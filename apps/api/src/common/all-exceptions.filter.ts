import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import type { FastifyReply } from "fastify";

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      // Nest's own pipeline already knows how to render every HttpException correctly (status,
      // body, and whatever headers were set on the exception itself) -- this filter must never
      // reimplement that. It exists only to catch what nothing else does.
      super.catch(exception, host);
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const response = host.switchToHttp().getResponse<FastifyReply>();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
  }
}
