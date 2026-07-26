"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useGeolocation, type Coords } from "./use-geolocation";

const LocationContext = createContext<Coords | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const coords = useGeolocation();
  return <LocationContext.Provider value={coords}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): Coords | null {
  return useContext(LocationContext);
}
