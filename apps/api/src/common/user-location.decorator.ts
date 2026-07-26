import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserLocationHeaderSchema } from "@gurmego/shared";

export interface UserLocation { lat: number; lng: number; }

// Validation now lives in `UserLocationHeaderSchema` (packages/shared/src/schemas/venue.schema.ts)
// per the project-wide rule that all API input is validated via Zod schemas from packages/shared
// -- this wrapper just adapts safeParse's result to this function's `undefined`-on-failure
// signature so every existing caller/test keeps working unchanged.
export function parseUserLocationHeader(header: string | undefined): UserLocation | undefined {
  if (typeof header !== "string") return undefined;
  const result = UserLocationHeaderSchema.safeParse(header);
  return result.success ? result.data : undefined;
}

export const UserLocationParam = createParamDecorator((_: unknown, ctx: ExecutionContext): UserLocation | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return parseUserLocationHeader(req.headers["x-user-location"]);
});
