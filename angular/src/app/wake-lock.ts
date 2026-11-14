import { Injectable, signal } from '@angular/core';

/**
 * Ébren tartja a képernyőt, amíg az oldal látható (Screen Wake Lock API).
 *
 * - A böngésző a zárat elengedi, ha a lap háttérbe kerül, ezért visszatéréskor újra kérjük.
 * - A Safari csak felhasználói koppintásból engedi: ha a kérés elutasítva, a következő
 *   koppintásnál (bárhol az oldalon) újrapróbáljuk, és ezt a `needsTap` jelzi a felületen.
 */
@Injectable({ providedIn: 'root' })
export class WakeLock {
  readonly supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  /** A felhasználó szeretné-e (kapcsolható). */
  readonly wanted = signal(true);
  /** Ténylegesen aktív-e most. */
  readonly active = signal(false);
  /** Be van kapcsolva, de a böngésző koppintásra vár, mielőtt engedi. */
  readonly needsTap = signal(false);

  private sentinel: WakeLockSentinel | null = null;
  private pending: Promise<void> | null = null;
  /** A saját kapcsológombra eső koppintást a gomb kezeli (toggle), nem ez. */
  private readonly retryOnTap = (e: Event) => {
    const onToggle = (e.target as Element | null)?.closest?.('[data-wakelock-toggle]');
    if (!onToggle) void this.acquire();
  };

  /** Párhuzamos hívások egyetlen kérésbe futnak össze. */
  acquire(): Promise<void> {
    if (!this.supported || !this.wanted() || this.sentinel) return Promise.resolve();
    if (document.visibilityState !== 'visible') return Promise.resolve();
    this.pending ??= this.request().finally(() => (this.pending = null));
    return this.pending;
  }

  private async request(): Promise<void> {
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
        this.active.set(false);
      });
      // Ha közben kikapcsolták, azonnal elengedjük.
      if (!this.wanted()) {
        await sentinel.release();
        return;
      }
      this.sentinel = sentinel;
      this.active.set(true);
      this.needsTap.set(false);
      document.removeEventListener('click', this.retryOnTap, true);
    } catch {
      // Tipikusan NotAllowedError: a Safari koppintást vár. A `click` felhasználói
      // aktivációnak számít, ezért arra próbáljuk újra (capture: a gomb előtt fut le).
      this.active.set(false);
      this.needsTap.set(this.wanted());
      document.addEventListener('click', this.retryOnTap, { capture: true, once: true });
    }
  }

  async release(): Promise<void> {
    const s = this.sentinel;
    this.sentinel = null;
    this.active.set(false);
    this.needsTap.set(false);
    document.removeEventListener('click', this.retryOnTap, true);
    if (s) await s.release().catch(() => undefined);
  }

  /** Kikapcsolja az ébrentartást (pl. az overlay „Most nem” gombja). */
  async disable(): Promise<void> {
    this.wanted.set(false);
    await this.release();
  }

  /**
   * Gombnyomás: ha be van kapcsolva, de még nem aktív, akkor bekapcsolja (nem kikapcsolja).
   * Egyébként ki/be vált.
   */
  async toggle(): Promise<void> {
    if (this.wanted() && !this.active()) {
      await this.acquire();
      return;
    }
    this.wanted.update((w) => !w);
    if (this.wanted()) await this.acquire();
    else await this.release();
  }
}
