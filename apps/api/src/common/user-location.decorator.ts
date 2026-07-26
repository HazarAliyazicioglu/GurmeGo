import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface UserLocation { lat: number; lng: number; }

export function parseUserLocationHeader(header: string | undefined): UserLocation | undefined {
  if (typeof header !== "string") return undefined;
  const parts = header.split(",");
  if (parts.length !== 2 || parts.some((p) => p.trim() === "")) return undefined;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

export const UserLocationParam = createParamDecorator((_: unknown, ctx: ExecutionContext): UserLocation | undefined => {
  const req = ctx.switchToHttp().getRequest();
  return parseUserLocationHeader(req.headers["x-user-location"]);
});
