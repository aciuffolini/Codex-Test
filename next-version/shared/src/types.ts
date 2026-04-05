/**
 * Additional shared types
 */

export interface GPSLocation {
  lat: number;
  lon: number;
  acc: number;
  alt?: number;
  ts: number;
}

export interface VisitContext {
  gps: GPSLocation | null;
  lastNote: string | null;
  hasPhoto: boolean;
  ts: number;
}


