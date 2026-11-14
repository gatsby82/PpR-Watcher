import { Injectable } from '@angular/core';

/** A figyelt parkolók azonosítói (a kozutfigyelo.budapestkozut.hu `id` paramétere). */
export const WATCHED_IDS = ['P061', 'P051'] as const;

/** Lekérdezési ciklus (ms). */
export const POLL_INTERVAL_MS = 10_000;

export interface ParkingFacility {
  id: string;
  name: string;
  capacity: number;
  free: number;
  openingHours?: string;
  /** A szerver szerinti utolsó adatfrissítés (helyi idő szerinti szöveg). */
  sourceUpdated?: string;
  fetchedAt: Date;
}

export type ParkingStatus = 'ok' | 'low' | 'full';

export function occupied(pf: ParkingFacility): number {
  return Math.min(Math.max(pf.capacity - pf.free, 0), pf.capacity);
}

export function freeRatio(pf: ParkingFacility): number {
  return pf.capacity === 0 ? 0 : pf.free / pf.capacity;
}

/** Ugyanaz a színezés, mint a Közútfigyelő térképén: tele / 25% alatt / bőven van. */
export function statusOf(pf: ParkingFacility): ParkingStatus {
  if (pf.free <= 0) return 'full';
  if (freeRatio(pf) < 0.25) return 'low';
  return 'ok';
}

function toInt(v: unknown): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseFacility(json: Record<string, unknown>): ParkingFacility {
  return {
    id: String(json['external_id'] ?? '?'),
    name: String(json['location_description'] ?? 'Ismeretlen parkoló'),
    capacity: toInt(json['capacity']),
    free: toInt(json['free_capacity']),
    openingHours: json['opening_hours'] ? String(json['opening_hours']) : undefined,
    sourceUpdated: json['last_data'] ? String(json['last_data']) : undefined,
    fetchedAt: new Date(),
  };
}

@Injectable({ providedIn: 'root' })
export class ParkingApi {
  private static readonly URL = 'https://kozutfigyelo-back.budapestkozut.hu/api/ikszr/get';

  async fetch(id: string): Promise<ParkingFacility> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch(ParkingApi.URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectType: 'parking-facilities', externalId: id }),
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const instance = body?.data?.instance;
      if (body?.success !== true || !instance) {
        throw new Error(body?.message || 'Hibás válasz');
      }
      return parseFacility(instance);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error('Időtúllépés');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
