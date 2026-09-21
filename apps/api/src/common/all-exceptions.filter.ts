import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import type { FastifyReply } from "fastify";

// docs/api-spec.md: every error body is `{ error: { code, message } }`.
const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
};

function codeForStatus(status: number): string {
  return STATUS_CODES[status] ?? `HTTP_${status}`;
}

// Exceptions the app throws deliberately already carry the envelope (`{ error: { code, message } }`).
function hasEnvelope(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const error = (body as { error?: unknown }).error;
  return typeof error === "object" && error !== null;
}

// Fastify raises its own errors (oversized body, unsupported media type, ...) as plain `Error`s that
// carry a numeric `statusCode`; only 4xx are client faults worth preserving -- anything else stays a 500.
function clientErrorStatus(exception: unknown): number | null {
  if (!(exception instanceof Error)) return null;
  const status = (exception as { statusCode?: unknown }).statusCode;
  return typeof status === "number" && status >= 400 && status < 500 ? status : null;
}

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      if (hasEnvelope(exception.getResponse())) {
        // Nest's own pipeline already knows how to render this correctly (status, body, and whatever
        // headers were set on the exception itself) -- this filter must never reimplement that.
        super.catch(exception, host);
        return;
      }
      // A framework-generated HttpException (unmatched route, ...) has no envelope: wrap it.
      this.sendEnvelope(host, exception.getStatus(), exception.message);
      return;
    }
    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== null) {
      this.sendEnvelope(host, clientStatus, (exception as Error).message);
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    this.sendEnvelope(host, HttpStatus.INTERNAL_SERVER_ERROR, "Beklenmeyen bir hata oluştu", "INTERNAL_ERROR");
  }

  private sendEnvelope(host: ArgumentsHost, status: number, message: string, code = codeForStatus(status)) {
    host.switchToHttp().getResponse<FastifyReply>().status(status).send({ error: { code, message } });
  }
}
