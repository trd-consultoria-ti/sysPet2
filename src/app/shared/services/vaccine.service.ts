import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PetVaccine, calculateVaccineStatus } from '../models/vaccine.model';

const STORAGE_KEY_VACCINES = 'syspet_vaccines_v1';

const DEFAULT_VACCINES: PetVaccine[] = [
  {
    id: 1,
    petId: 1,
    petName: 'Rex',
    customerName: 'Carlos Eduardo',
    vaccineName: 'V10 Polivalente Canina',
    appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 300).toISOString().split('T')[0],
    nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 65).toISOString().split('T')[0],
    batch: 'BR-2025-V10-884',
    manufacturer: 'Zoetis',
    vetName: 'Dra. Camila Alencar',
    vetCrmv: 'CRMV-DF 4192',
    notes: 'Pet reagiu bem, sem febre.'
  },
  {
    id: 2,
    petId: 1,
    petName: 'Rex',
    customerName: 'Carlos Eduardo',
    vaccineName: 'Antirrábica (Raiva)',
    appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 380).toISOString().split('T')[0],
    nextDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString().split('T')[0],
    batch: 'DEF-RAIV-2024',
    manufacturer: 'MSD Saúde Animal',
    vetName: 'Dr. Lucas Prado',
    vetCrmv: 'CRMV-DF 3810',
    notes: 'Exige reforço imediato anual.'
  },
  {
    id: 3,
    petId: 2,
    petName: 'Mel',
    customerName: 'Fernanda Lima',
    vaccineName: 'V8 Polivalente Canina',
    appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString().split('T')[0],
    nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 185).toISOString().split('T')[0],
    batch: 'V8-ZOETIS-901',
    manufacturer: 'Zoetis',
    vetName: 'Dra. Camila Alencar',
    vetCrmv: 'CRMV-DF 4192',
    notes: 'Dose anual de reforço em dia.'
  },
  {
    id: 4,
    petId: 2,
    petName: 'Mel',
    customerName: 'Fernanda Lima',
    vaccineName: 'Gripe Canina / Tosse dos Canis (Pneumodog)',
    appliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 340).toISOString().split('T')[0],
    nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString().split('T')[0],
    batch: 'PNEUMO-DF-12',
    manufacturer: 'Boehringer Ingelheim',
    vetName: 'Dra. Camila Alencar',
    vetCrmv: 'CRMV-DF 4192',
    notes: 'Vence em breve (reforço recomendado).'
  }
];

@Injectable({
  providedIn: 'root'
})
export class VaccineService {
  private vaccines$ = new BehaviorSubject<PetVaccine[]>(this.loadVaccines());

  constructor(private http: HttpClient) {
    this.refresh();
  }

  private loadVaccines(): PetVaccine[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VACCINES);
      if (stored) {
        const list: PetVaccine[] = JSON.parse(stored);
        return list.map(v => ({ ...v, status: calculateVaccineStatus(v.nextDueAt) }));
      }
    } catch (e) {
      console.warn('Erro ao ler vacinas do localStorage', e);
    }
    return DEFAULT_VACCINES.map(v => ({ ...v, status: calculateVaccineStatus(v.nextDueAt) }));
  }

  private saveVaccines(list: PetVaccine[]): void {
    try {
      const processed = list.map(v => ({ ...v, status: calculateVaccineStatus(v.nextDueAt) }));
      localStorage.setItem(STORAGE_KEY_VACCINES, JSON.stringify(processed));
      this.vaccines$.next(processed);
    } catch (e) {
      console.warn('Erro ao salvar vacinas no localStorage', e);
    }
  }

  getVaccines(): Observable<PetVaccine[]> {
    return this.http.get<PetVaccine[]>('/api/vaccines').pipe(
      tap(list => this.saveVaccines(list)),
      catchError(() => this.vaccines$.asObservable())
    );
  }

  getVaccinesForPet(petName: string, petId?: number): PetVaccine[] {
    const list = this.vaccines$.getValue();
    if (petId) {
      return list.filter(v => v.petId === petId);
    }
    if (petName) {
      const clean = petName.trim().toLowerCase();
      return list.filter(v => v.petName.trim().toLowerCase() === clean);
    }
    return [];
  }

  refresh(): void {
    this.http.get<PetVaccine[]>('/api/vaccines').subscribe({
      next: list => this.saveVaccines(list),
      error: () => {}
    });
  }

  addVaccine(data: Omit<PetVaccine, 'id' | 'status'>): Observable<PetVaccine> {
    const nextId = this.vaccines$.getValue().length
      ? Math.max(...this.vaccines$.getValue().map(v => v.id)) + 1
      : 1;

    const newVaccine: PetVaccine = {
      ...data,
      id: nextId,
      status: calculateVaccineStatus(data.nextDueAt)
    };

    return this.http.post<PetVaccine>('/api/vaccines', newVaccine).pipe(
      catchError(() => of(newVaccine)),
      tap(created => {
        const current = this.vaccines$.getValue();
        this.saveVaccines([created, ...current]);
      })
    );
  }

  deleteVaccine(id: number): Observable<boolean> {
    return this.http.delete<boolean>(`/api/vaccines/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const filtered = this.vaccines$.getValue().filter(v => v.id !== id);
        this.saveVaccines(filtered);
      })
    );
  }
}
