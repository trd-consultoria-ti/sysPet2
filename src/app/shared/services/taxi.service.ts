import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TaxiRegion, TaxiTrip, TaxiTripStatus } from '../models/taxi.model';

const STORAGE_REGIONS_KEY = 'syspet_taxi_regions_v1';
const STORAGE_TRIPS_KEY = 'syspet_taxi_trips_v1';

const DEFAULT_REGIONS: TaxiRegion[] = [
  {
    id: 'reg-qc3',
    name: 'Riacho Fundo QC3',
    aliases: ['qc3', 'qc 3', 'riacho fundo', 'riacho fundo 1', 'qc-3'],
    price: 10.00,
    active: true,
    notes: 'Bairro local da loja'
  },
  {
    id: 'reg-cond',
    name: 'Condomínios Riacho Fundo / SMPW',
    aliases: ['condominio', 'condomínio', 'condominios', 'smpw', 'park way', 'estância'],
    price: 20.00,
    active: true,
    notes: 'Faixa R$15 a R$30 (padrão R$20)'
  },
  {
    id: 'reg-recanto',
    name: 'Recanto das Emas',
    aliases: ['recanto', 'recanto das emas', 'qd', 'quadra'],
    price: 20.00,
    active: true,
    notes: 'Região vizinha'
  },
  {
    id: 'reg-ponte-alta',
    name: 'Ponte Alta Norte',
    aliases: ['ponte alta', 'ponte alta norte', 'gama', 'df 475'],
    price: 20.00,
    active: true,
    notes: 'Acesso rápido'
  },
  {
    id: 'reg-bandeirante',
    name: 'Núcleo Bandeirante',
    aliases: ['bandeirante', 'nucleo bandeirante', 'núcleo bandeirante', 'divineia', 'metropolitana'],
    price: 15.00,
    active: true,
    notes: 'Proximidade Riacho Fundo'
  },
  {
    id: 'reg-aguas-claras',
    name: 'Águas Claras / Arniqueiras',
    aliases: ['aguas claras', 'águas claras', 'arniqueiras', 'areal', 'adão e eva'],
    price: 30.00,
    active: true,
    notes: 'Região expandida'
  }
];

@Injectable({
  providedIn: 'root'
})
export class TaxiService {
  private regions$ = new BehaviorSubject<TaxiRegion[]>(this.loadRegionsFromStorage());
  private trips$ = new BehaviorSubject<TaxiTrip[]>(this.loadTripsFromStorage());

  constructor(private http: HttpClient) {
    this.refreshRegions();
    this.refreshTrips();
  }

  // --- REGIONS (HU-12) ---

  private loadRegionsFromStorage(): TaxiRegion[] {
    try {
      const saved = localStorage.getItem(STORAGE_REGIONS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao ler taxi_regions do localStorage', e);
    }
    this.saveRegionsToStorage(DEFAULT_REGIONS);
    return DEFAULT_REGIONS;
  }

  private saveRegionsToStorage(regions: TaxiRegion[]): void {
    try {
      localStorage.setItem(STORAGE_REGIONS_KEY, JSON.stringify(regions));
      this.regions$.next(regions);
    } catch (e) {
      console.warn('Erro ao salvar taxi_regions no localStorage', e);
    }
  }

  getRegions(): Observable<TaxiRegion[]> {
    return this.http.get<TaxiRegion[]>('/api/taxi/regions').pipe(
      tap(regions => this.saveRegionsToStorage(regions)),
      catchError(() => this.regions$.asObservable())
    );
  }

  getRegionsSnapshot(): TaxiRegion[] {
    return this.regions$.getValue();
  }

  refreshRegions(): void {
    this.http.get<TaxiRegion[]>('/api/taxi/regions').subscribe({
      next: (data) => this.saveRegionsToStorage(data),
      error: () => {}
    });
  }

  addRegion(region: Omit<TaxiRegion, 'id'>): Observable<TaxiRegion> {
    const newRegion: TaxiRegion = {
      ...region,
      id: 'reg-' + Date.now(),
      createdAt: new Date().toISOString()
    };

    return this.http.post<TaxiRegion>('/api/taxi/regions', newRegion).pipe(
      catchError(() => of(newRegion)),
      tap(created => {
        const current = this.regions$.getValue();
        this.saveRegionsToStorage([...current, created]);
      })
    );
  }

  updateRegion(id: string, updates: Partial<TaxiRegion>): Observable<TaxiRegion> {
    return this.http.put<TaxiRegion>(`/api/taxi/regions/${id}`, updates).pipe(
      catchError(() => {
        const current = this.regions$.getValue();
        const existing = current.find(r => r.id === id);
        return of({ ...existing, ...updates, id } as TaxiRegion);
      }),
      tap(updated => {
        const current = this.regions$.getValue();
        const idx = current.findIndex(r => r.id === id);
        if (idx !== -1) {
          const list = [...current];
          list[idx] = updated;
          this.saveRegionsToStorage(list);
        }
      })
    );
  }

  deleteRegion(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`/api/taxi/regions/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const list = this.regions$.getValue().filter(r => r.id !== id);
        this.saveRegionsToStorage(list);
      })
    );
  }

  /**
   * Busca região inteligente por texto digitado pelo atendente (HU-12)
   */
  findRegionByQuery(query: string): TaxiRegion | null {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const regions = this.regions$.getValue().filter(r => r.active !== false);

    // 1. Match exato ou parcial no nome
    const exactName = regions.find(r => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase()));
    if (exactName) return exactName;

    // 2. Match em aliases
    for (const r of regions) {
      if (r.aliases && Array.isArray(r.aliases)) {
        for (const alias of r.aliases) {
          const al = alias.toLowerCase().trim();
          if (q.includes(al) || al.includes(q)) {
            return r;
          }
        }
      }
    }

    return null;
  }

  // --- TRIPS / CORRIDAS VINCULADAS (HU-13 & HU-15) ---

  private loadTripsFromStorage(): TaxiTrip[] {
    try {
      const saved = localStorage.getItem(STORAGE_TRIPS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Erro ao carregar taxi_trips do storage', e);
    }
    return [];
  }

  private saveTripsToStorage(trips: TaxiTrip[]): void {
    try {
      localStorage.setItem(STORAGE_TRIPS_KEY, JSON.stringify(trips));
      this.trips$.next(trips);
    } catch (e) {
      console.warn('Erro ao salvar taxi_trips no storage', e);
    }
  }

  getTrips(): Observable<TaxiTrip[]> {
    return this.http.get<TaxiTrip[]>('/api/taxi/trips').pipe(
      tap(trips => this.saveTripsToStorage(trips)),
      catchError(() => this.trips$.asObservable())
    );
  }

  getTripsSnapshot(): TaxiTrip[] {
    return this.trips$.getValue();
  }

  getTripByCheckinId(checkinId: string): TaxiTrip | undefined {
    return this.trips$.getValue().find(t => t.checkinId === checkinId);
  }

  refreshTrips(): void {
    this.http.get<TaxiTrip[]>('/api/taxi/trips').subscribe({
      next: (trips) => this.saveTripsToStorage(trips),
      error: () => {}
    });
  }

  createTrip(tripData: Partial<TaxiTrip>): Observable<TaxiTrip> {
    const newTrip: TaxiTrip = {
      id: 'trip-' + Date.now(),
      checkinId: tripData.checkinId,
      petId: tripData.petId,
      petName: tripData.petName || 'Pet',
      customerName: tripData.customerName || 'Cliente',
      customerPhone: tripData.customerPhone || '',
      tripType: tripData.tripType || 'ida_e_volta',
      originAddress: tripData.originAddress || '',
      regionId: tripData.regionId || '',
      regionName: tripData.regionName || '',
      price: tripData.price || 0,
      driverName: tripData.driverName || 'Lucas (O Rapaz)',
      status: tripData.status || 'a_caminho_buscar',
      notes: tripData.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.http.post<TaxiTrip>('/api/taxi/trips', newTrip).pipe(
      catchError(() => of(newTrip)),
      tap(created => {
        const current = this.trips$.getValue();
        this.saveTripsToStorage([created, ...current]);
      })
    );
  }

  updateTripStatus(id: string, status: TaxiTripStatus): Observable<TaxiTrip> {
    return this.http.patch<TaxiTrip>(`/api/taxi/trips/${id}/status`, { status }).pipe(
      catchError(() => {
        const current = this.trips$.getValue();
        const trip = current.find(t => t.id === id);
        return of({ ...trip, status, updatedAt: new Date().toISOString() } as TaxiTrip);
      }),
      tap(updated => {
        const current = this.trips$.getValue();
        const idx = current.findIndex(t => t.id === id);
        if (idx !== -1) {
          const list = [...current];
          list[idx] = updated;
          this.saveTripsToStorage(list);
        }
      })
    );
  }

  deleteTrip(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`/api/taxi/trips/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const list = this.trips$.getValue().filter(t => t.id !== id);
        this.saveTripsToStorage(list);
      })
    );
  }
}
