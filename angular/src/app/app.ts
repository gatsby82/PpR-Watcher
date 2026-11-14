import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import {
  ParkingApi,
  ParkingFacility,
  POLL_INTERVAL_MS,
  WATCHED_IDS,
  freeRatio,
  occupied,
  statusOf,
} from './parking';
import { WakeLock } from './wake-lock';

interface CardState {
  id: string;
  facility?: ParkingFacility;
  error?: string;
  /** Változás az előző lekérdezéshez képest. */
  delta?: number;
}

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly api = inject(ParkingApi);
  protected readonly wakeLock = inject(WakeLock);

  protected readonly pollSeconds = POLL_INTERVAL_MS / 1000;
  protected readonly cards = signal<CardState[]>(WATCHED_IDS.map((id) => ({ id })));
  protected readonly loading = signal(false);
  protected readonly lastFetched = signal<Date | null>(null);
  protected readonly lastFetchFailed = signal(false);
  /** Másodpercenként ketyeg, hogy az „x mp-e” felirat frissüljön. */
  private readonly now = signal(Date.now());

  protected readonly secondsAgo = computed(() => {
    const t = this.lastFetched();
    return t ? Math.max(0, Math.round((this.now() - t.getTime()) / 1000)) : null;
  });

  /** Ha a megszokott ciklusnál jóval régebbi az adat, figyelmeztetünk. */
  protected readonly stale = computed(() => {
    const s = this.secondsAgo();
    return s !== null && s > this.pollSeconds * 3;
  });

  protected readonly occupied = occupied;
  protected readonly freeRatio = freeRatio;
  protected readonly statusOf = statusOf;

  private pollTimer?: ReturnType<typeof setInterval>;
  private tickTimer?: ReturnType<typeof setInterval>;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisibility);
    if (document.visibilityState === 'visible') this.start();
  }

  /** Csak előtérben kérdezünk: háttérbe téve leáll, visszatéréskor azonnal frissít. */
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') this.start();
    else this.stop();
  };

  private start(): void {
    this.stop();
    void this.refresh();
    void this.wakeLock.acquire();
    this.pollTimer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stop(): void {
    clearInterval(this.pollTimer);
    clearInterval(this.tickTimer);
    this.pollTimer = this.tickTimer = undefined;
  }

  protected async refresh(): Promise<void> {
    if (this.loading()) return; // ne fusson két lekérdezés egymásra
    this.loading.set(true);

    const results = await Promise.allSettled(WATCHED_IDS.map((id) => this.api.fetch(id)));

    let anyOk = false;
    this.cards.update((cards) =>
      cards.map((card, i) => {
        const r = results[i];
        if (r.status === 'fulfilled') {
          anyOk = true;
          const prev = card.facility;
          const delta = prev && prev.free !== r.value.free ? r.value.free - prev.free : card.delta;
          return { id: card.id, facility: r.value, delta };
        }
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        return { ...card, error: msg };
      }),
    );

    if (anyOk) this.lastFetched.set(new Date());
    this.lastFetchFailed.set(results.some((r) => r.status === 'rejected'));
    this.now.set(Date.now());
    this.loading.set(false);
  }
}
