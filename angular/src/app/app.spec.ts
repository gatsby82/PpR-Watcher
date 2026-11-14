import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ParkingApi, parseFacility, statusOf, freeRatio, occupied } from './parking';

describe('parseFacility', () => {
  it('feldolgozza az API válaszát', () => {
    const pf = parseFacility({
      external_id: 'P061',
      location_description: 'KÖKI Terminál P+R parkolóház',
      capacity: 330,
      free_capacity: 280,
    });
    expect(pf.id).toBe('P061');
    expect(pf.name).toBe('KÖKI Terminál P+R parkolóház');
    expect(pf.free).toBe(280);
    expect(occupied(pf)).toBe(50);
    expect(freeRatio(pf)).toBeCloseTo(280 / 330);
  });

  it('szövegként érkező számokat is kezel', () => {
    const pf = parseFacility({ external_id: 'P051', capacity: '206', free_capacity: '184' });
    expect(pf.capacity).toBe(206);
    expect(pf.free).toBe(184);
    expect(pf.name).toBe('Ismeretlen parkoló');
  });
});

describe('statusOf', () => {
  const pf = (free: number) => parseFacility({ capacity: 100, free_capacity: free });
  it('zöld, ha bőven van hely', () => expect(statusOf(pf(50))).toBe('ok'));
  it('narancs 25% alatt', () => expect(statusOf(pf(24))).toBe('low'));
  it('piros, ha tele', () => expect(statusOf(pf(0))).toBe('full'));
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: ParkingApi,
          useValue: {
            fetch: async (id: string) =>
              parseFacility({
                external_id: id,
                location_description: `Parkoló ${id}`,
                capacity: 100,
                free_capacity: 42,
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('megjeleníti a parkolók adatait', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Parkoló P061');
    expect(el.textContent).toContain('Parkoló P051');
    expect(el.querySelectorAll('.free').length).toBe(2);
    fixture.destroy();
  });
});
