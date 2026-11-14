import { Injectable, signal } from '@angular/core';

/**
 * Ébren tartja a képernyőt, amíg az oldal látható (Screen Wake Lock API).
 * A böngésző a zárat elengedi, ha a lap háttérbe kerül, ezért visszatéréskor újra kérjük.
 * Ha a böngésző felhasználói interakcióhoz köti, az első érintéskor újrapróbáljuk.
 */
@Injectable({ providedIn: 'root' })
export class WakeLock {
  readonly supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  /** A felhasználó szeretné-e (kapcsolható). */
  readonly wanted = signal(true);
  /** Ténylegesen aktív-e most. */
  readonly active = signal(false);

  private sentinel: WakeLockSentinel | null = null;
  private retryOnTouch = () => this.acquire();

  async acquire(): Promise<void> {
    if (!this.supported || !this.wanted() || this.sentinel) return;
    if (document.visibilityState !== 'visible') return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.active.set(true);
      document.removeEventListener('pointerdown', this.retryOnTouch);
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        this.active.set(false);
      });
    } catch {
      // Pl. NotAllowedError: majd az első érintésnél újra megpróbáljuk.
      this.active.set(false);
      document.addEventListener('pointerdown', this.retryOnTouch, { once: true });
    }
  }

  async release(): Promise<void> {
    const s = this.sentinel;
    this.sentinel = null;
    this.active.set(false);
    if (s) await s.release().catch(() => undefined);
  }

  async toggle(): Promise<void> {
    this.wanted.update((w) => !w);
    if (this.wanted()) await this.acquire();
    else await this.release();
  }
}
