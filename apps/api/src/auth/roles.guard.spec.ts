import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function mockContext(user: { role: string } | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows when user role is in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator", "admin"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext({ role: "curator" }))).toBe(true);
  });

  it("denies when user role is not in the required list", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["curator", "admin"]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(mockContext({ role: "user" }))).toThrow(ForbiddenException);
  });

  it("allows when no roles are required (public route)", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext(undefined))).toBe(true);
  });
});

describe("RolesGuard — 401 vs 403", () => {
  const makeCtx = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any);

  it("throws UnauthorizedException when there is no user", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(UnauthorizedException);
  });

  it("throws ForbiddenException when the role is insufficient", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(() => guard.canActivate(makeCtx({ role: "user" }))).toThrow(ForbiddenException);
  });

  it("allows access when the role matches", () => {
    const guard = new RolesGuard({ getAllAndOverride: jest.fn().mockReturnValue(["curator"]) } as any);
    expect(guard.canActivate(makeCtx({ role: "curator" }))).toBe(true);
  });
});
