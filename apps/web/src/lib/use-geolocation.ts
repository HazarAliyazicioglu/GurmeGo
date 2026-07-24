"use client";
import { useEffect, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

export function useGeolocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // permission denied or unavailable — silently fall back, no error UI needed
      { timeout: 5000 },
    );
  }, []);

  return coords;
}
