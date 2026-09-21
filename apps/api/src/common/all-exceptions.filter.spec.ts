import { ArgumentsHost, HttpException, HttpStatus, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./all-exceptions.filter";

describe("AllExceptionsFilter", () => {
  it("delegates HttpException handling to BaseExceptionFilter.catch (Nest's own pipeline)", () => {
    const superCatchSpy = jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    const original = new HttpException({ error: { code: "TOO_MANY_REQUESTS", message: "Yavaşlayın" } }, HttpStatus.TOO_MANY_REQUESTS);
    const host = {} as ArgumentsHost;
    filter.catch(original, host);
    expect(superCatchSpy).toHaveBeenCalledWith(original, host);
    superCatchSpy.mockRestore();
  });

  it("converts an unhandled non-HttpException error to a 500 envelope without calling super.catch", () => {
    const superCatchSpy = jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    filter.catch(new Error("boom"), host);
    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
    superCatchSpy.mockRestore();
  });

  // docs/api-spec.md: every error body is `{ error: { code, message } }`. Exceptions the app throws
  // already carry that envelope; framework-generated ones (unmatched route, oversized body, ...) did not.
  function harness() {
    const superCatchSpy = jest.spyOn(BaseExceptionFilter.prototype, "catch").mockImplementation(() => {});
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    const filter = new AllExceptionsFilter({ httpAdapter: {} } as HttpAdapterHost);
    return { filter, host, status, send, superCatchSpy };
  }

  it("wraps a framework-generated HttpException (no envelope) into { error: { code, message } } with its own status", () => {
    const { filter, host, status, send, superCatchSpy } = harness();
    filter.catch(new NotFoundException("Cannot GET /v1/nope"), host);
    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({ error: { code: "NOT_FOUND", message: "Cannot GET /v1/nope" } });
    superCatchSpy.mockRestore();
  });

  it("maps an oversized-body HttpException to PAYLOAD_TOO_LARGE / 413", () => {
    const { filter, host, status, send, superCatchSpy } = harness();
    filter.catch(new PayloadTooLargeException("too big"), host);
    expect(status).toHaveBeenCalledWith(413);
    expect(send).toHaveBeenCalledWith({ error: { code: "PAYLOAD_TOO_LARGE", message: "too big" } });
    superCatchSpy.mockRestore();
  });

  it("uses HTTP_<status> for a status without a dedicated code", () => {
    const { filter, host, status, send, superCatchSpy } = harness();
    filter.catch(new HttpException("teapot", 418), host);
    expect(status).toHaveBeenCalledWith(418);
    expect(send).toHaveBeenCalledWith({ error: { code: "HTTP_418", message: "teapot" } });
    superCatchSpy.mockRestore();
  });

  it("keeps a Fastify-raised 4xx (plain Error with statusCode, e.g. multipart file too large) as that 4xx, not a 500", () => {
    const { filter, host, status, send, superCatchSpy } = harness();
    const fastifyErr = Object.assign(new Error("request file too large"), { statusCode: 413, code: "FST_REQ_FILE_TOO_LARGE" });
    filter.catch(fastifyErr, host);
    expect(superCatchSpy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(413);
    expect(send).toHaveBeenCalledWith({ error: { code: "PAYLOAD_TOO_LARGE", message: "request file too large" } });
    superCatchSpy.mockRestore();
  });

  it("still treats a plain Error with a 5xx-or-absent statusCode as INTERNAL_ERROR", () => {
    const { filter, host, status, send, superCatchSpy } = harness();
    filter.catch(Object.assign(new Error("db down"), { statusCode: 503 }), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({ error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir hata oluştu" } });
    superCatchSpy.mockRestore();
  });
});
