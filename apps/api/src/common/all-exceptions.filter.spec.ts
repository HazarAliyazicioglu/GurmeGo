import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
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
});
