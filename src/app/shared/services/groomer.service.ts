import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Groomer, GroomerCommissionReport, GroomerCommissionItem } from '../models/groomer.model';
import { DailyService } from '../models/daily-service.model';

const STORAGE_KEY_GROOMERS = 'syspet_groomers_v1';

const DEFAULT_GROOMERS: Groomer[] = [
  {
    id: 1,
    name: 'Carlos Silva (Tosador)',
    phone: '(61) 99111-2233',
    active: true,
    commissionRate: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Mariana Costa (Banhista / Tosa)',
    phone: '(61) 98222-3344',
    active: true,
    commissionRate: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Roberto Peixoto (Tosador Especialista)',
    phone: '(61) 99333-4455',
    active: true,
    commissionRate: 15,
    createdAt: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class GroomerService {
  private groomers$ = new BehaviorSubject<Groomer[]>(this.loadGroomers());

  constructor(private http: HttpClient) {
    this.refresh();
  }

  private loadGroomers(): Groomer[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GROOMERS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler groomers do localStorage', e);
    }
    this.saveGroomers(DEFAULT_GROOMERS);
    return DEFAULT_GROOMERS;
  }

  private saveGroomers(list: Groomer[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_GROOMERS, JSON.stringify(list));
      this.groomers$.next(list);
    } catch (e) {
      console.warn('Erro ao salvar groomers no localStorage', e);
    }
  }

  getGroomers(): Observable<Groomer[]> {
    return this.http.get<Groomer[]>('/api/groomers').pipe(
      tap(list => this.saveGroomers(list)),
      catchError(() => this.groomers$.asObservable())
    );
  }

  getGroomersSnapshot(): Groomer[] {
    return this.groomers$.getValue();
  }

  refresh(): void {
    this.http.get<Groomer[]>('/api/groomers').subscribe({
      next: (list) => this.saveGroomers(list),
      error: () => {}
    });
  }

  addGroomer(data: Omit<Groomer, 'id'>): Observable<Groomer> {
    const nextId = this.groomers$.getValue().length
      ? Math.max(...this.groomers$.getValue().map(g => g.id)) + 1
      : 1;

    const newGroomer: Groomer = {
      ...data,
      id: nextId,
      commissionRate: Number(data.commissionRate) || 15,
      active: data.active !== false,
      createdAt: new Date().toISOString()
    };

    return this.http.post<Groomer>('/api/groomers', newGroomer).pipe(
      catchError(() => of(newGroomer)),
      tap(created => {
        const current = this.groomers$.getValue();
        this.saveGroomers([...current, created]);
      })
    );
  }

  updateGroomer(id: number, updates: Partial<Groomer>): Observable<Groomer> {
    return this.http.put<Groomer>(`/api/groomers/${id}`, updates).pipe(
      catchError(() => {
        const current = this.groomers$.getValue();
        const existing = current.find(g => g.id === id);
        return of({ ...existing, ...updates, id } as Groomer);
      }),
      tap(updated => {
        const current = this.groomers$.getValue();
        const idx = current.findIndex(g => g.id === id);
        if (idx !== -1) {
          const list = [...current];
          list[idx] = updated;
          this.saveGroomers(list);
        }
      })
    );
  }

  deleteGroomer(id: number): Observable<boolean> {
    return this.http.delete<boolean>(`/api/groomers/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const current = this.groomers$.getValue().filter(g => g.id !== id);
        this.saveGroomers(current);
      })
    );
  }

  /**
   * Cálculo de Relatório de Comissões (HU-19)
   * Regra oficial: 15% do valor do serviço para 1 tosador.
   * Em dupla (2 tosadores), cada um recebe 7.5% (rateio igualitário de 15%).
   */
  calculateCommissions(
    dailyServices: DailyService[],
    fromDate?: string,
    toDate?: string
  ): GroomerCommissionReport[] {
    const groomers = this.groomers$.getValue();
    const reportsMap = new Map<number, GroomerCommissionReport>();

    for (const g of groomers) {
      reportsMap.set(g.id, {
        groomerId: g.id,
        groomerName: g.name,
        phone: g.phone,
        totalServices: 0,
        totalServiceRevenue: 0,
        totalCommissionDue: 0,
        items: []
      });
    }

    for (const ds of dailyServices) {
      if (ds.status === 'cancelado') continue;
      if (fromDate && ds.date < fromDate) continue;
      if (toDate && ds.date > toDate) continue;

      const baseServicePrice = Number(ds.finalPrice || ds.estimatedPrice || 0) - Number(ds.taxiPrice || 0);
      if (baseServicePrice <= 0) continue;

      const isPair = !!ds.isGroomerPair && !!ds.secondGroomerName;

      // Tosador Principal
      let g1 = groomers.find(g => g.id === ds.groomerId);
      if (!g1 && ds.groomerName) {
        g1 = groomers.find(g => g.name.toLowerCase().includes(ds.groomerName!.toLowerCase()) || ds.groomerName!.toLowerCase().includes(g.name.toLowerCase()));
      }

      if (g1) {
        const rate = isPair ? (g1.commissionRate / 2) : g1.commissionRate;
        const commAmount = (baseServicePrice * rate) / 100;

        const report = reportsMap.get(g1.id)!;
        report.totalServices += 1;
        report.totalServiceRevenue += baseServicePrice;
        report.totalCommissionDue += commAmount;
        report.items.push({
          serviceId: ds.id,
          date: ds.date,
          petName: ds.petName,
          customerName: ds.customerName,
          serviceName: ds.serviceName,
          servicePrice: baseServicePrice,
          isPair,
          partnerGroomerName: ds.secondGroomerName || undefined,
          commissionRate: rate,
          commissionAmount: commAmount
        });
      }

      // Segundo Tosador (em Dupla)
      if (isPair) {
        let g2 = groomers.find(g => g.id === ds.secondGroomerId);
        if (!g2 && ds.secondGroomerName) {
          g2 = groomers.find(g => g.name.toLowerCase().includes(ds.secondGroomerName!.toLowerCase()) || ds.secondGroomerName!.toLowerCase().includes(g.name.toLowerCase()));
        }

        if (g2 && g2.id !== g1?.id) {
          const rate = g2.commissionRate / 2;
          const commAmount = (baseServicePrice * rate) / 100;

          const report = reportsMap.get(g2.id)!;
          report.totalServices += 1;
          report.totalServiceRevenue += baseServicePrice;
          report.totalCommissionDue += commAmount;
          report.items.push({
            serviceId: ds.id,
            date: ds.date,
            petName: ds.petName,
            customerName: ds.customerName,
            serviceName: ds.serviceName,
            servicePrice: baseServicePrice,
            isPair: true,
            partnerGroomerName: ds.groomerName || undefined,
            commissionRate: rate,
            commissionAmount: commAmount
          });
        }
      }
    }

    return Array.from(reportsMap.values());
  }
}
