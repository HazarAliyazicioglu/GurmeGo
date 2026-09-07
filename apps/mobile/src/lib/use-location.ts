import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { Coords } from "./api";

// Native counterpart of apps/web/src/lib/use-geolocation.ts's useGeolocation() -- same "silently
// fall back to null on denial/error, no error UI" contract, but through Expo's real native
// permission prompt instead of the browser's geolocation API.
export function useLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    })().catch(() => {
      // Permission denied or position unavailable -- silently fall back, same contract as the
      // web hook this mirrors.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
