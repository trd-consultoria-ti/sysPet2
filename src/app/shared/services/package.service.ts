import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PetPackage, PackageStatus } from '../models/package.model';
import { CashService } from './cash.service';

const STORAGE_KEY_PACKAGES = 'syspet_packages_v1';

const DEFAULT_PACKAGES: PetPackage[] = [
  {
    id: 1,
    petName: 'Mel',
    customerName: 'Fernanda Lima',
    customerPhone: '(61) 98811-2233',
    packageName: 'Plano Mensal Clássico (4 Banhos + 1 Tosa Higiênica)',
    totalBaths: 4,
    usedBaths: 2,
    totalGrooms: 1,
    usedGrooms: 0,
    price: 190.00,
    purchaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString().split('T')[0],
    expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString().split('T')[0],
    status: 'ativo',
    notes: 'Shih-tzu de 5.5kg. Banho semanal aos sábados.'
  },
  {
    id: 2,
    petName: 'Thor',
    customerName: 'Juliana Mendes',
    customerPhone: '(61) 98765-4321',
    packageName: 'Plano 4 Banhos Semanais',
    totalBaths: 4,
    usedBaths: 3,
    totalGrooms: 0,
    usedGrooms: 0,
    price: 150.00,
    purchaseDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString().split('T')[0],
    expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().split('T')[0],
    status: 'ativo',
    notes: 'Golden Retriever filhote 8kg.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class PackageService {
  private packages$ = new BehaviorSubject<PetPackage[]>(this.loadPackages());

  constructor(
    private http: HttpClient,
    private cashService: CashService
  ) {
    this.refresh();
  }

  private loadPackages(): PetPackage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PACKAGES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler pacotes do localStorage', e);
    }
    return DEFAULT_PACKAGES;
  }

  private savePackages(list: PetPackage[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PACKAGES, JSON.stringify(list));
      this.packages$.next(list);
    } catch (e) {
      console.warn('Erro ao salvar pacotes no localStorage', e);
    }
  }

  getPackages(): Observable<PetPackage[]> {
    return this.http.get<PetPackage[]>('/api/packages').pipe(
      tap(list => this.savePackages(list)),
      catchError(() => this.packages$.asObservable())
    );
  }

  getPackagesSnapshot(): PetPackage[] {
    return this.packages$.getValue();
  }

  refresh(): void {
    this.http.get<PetPackage[]>('/api/packages').subscribe({
      next: list => this.savePackages(list),
      error: () => {}
    });
  }

  createPackage(data: Omit<PetPackage, 'id'>, registerInCash = true, paymentMethod = 'pix'): Observable<PetPackage> {
    const nextId = this.packages$.getValue().length
      ? Math.max(...this.packages$.getValue().map(p => p.id)) + 1
      : 1;

    const newPkg: PetPackage = {
      ...data,
      id: nextId,
      usedBaths: data.usedBaths || 0,
      usedGrooms: data.usedGrooms || 0,
      status: 'ativo'
    };

    if (registerInCash && newPkg.price > 0) {
      this.cashService.register({
        type: 'entrada',
        amount: newPkg.price,
        description: `Venda de Pacote Mensal [${newPkg.packageName}] — Pet ${newPkg.petName} (${newPkg.customerName})`,
        paymentMethod
      }).subscribe();
    }

    return this.http.post<PetPackage>('/api/packages', newPkg).pipe(
      catchError(() => of(newPkg)),
      tap(created => {
        const current = this.packages$.getValue();
        this.savePackages([created, ...current]);
      })
    );
  }

  /**
   * Consumo de crédito do pacote pelo check-in (HU-25)
   */
  consumeCredit(packageId: number, type: 'bath' | 'groom'): Observable<PetPackage | null> {
    const current = this.packages$.getValue();
    const pkg = current.find(p => p.id === packageId);
    if (!pkg) return of(null);

    let updatedBaths = pkg.usedBaths;
    let updatedGrooms = pkg.usedGrooms;

    if (type === 'bath') {
      if (pkg.usedBaths >= pkg.totalBaths) return of(null);
      updatedBaths += 1;
    } else if (type === 'groom') {
      if (pkg.usedGrooms >= pkg.totalGrooms) return of(null);
      updatedGrooms += 1;
    }

    const allUsed = (updatedBaths >= pkg.totalBaths) && (updatedGrooms >= pkg.totalGrooms);
    const newStatus: PackageStatus = allUsed ? 'esgotado' : 'ativo';

    const updatedPkg: PetPackage = {
      ...pkg,
      usedBaths: updatedBaths,
      usedGrooms: updatedGrooms,
      status: newStatus
    };

    return this.http.put<PetPackage>(`/api/packages/${packageId}`, updatedPkg).pipe(
      catchError(() => of(updatedPkg)),
      tap(saved => {
        const list = this.packages$.getValue().map(p => p.id === saved.id ? saved : p);
        this.savePackages(list);
      })
    );
  }

  findActivePackageForPet(petName: string, customerName?: string): PetPackage | undefined {
    if (!petName) return undefined;
    const cleanPet = petName.trim().toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    return this.packages$.getValue().find(p => {
      const matchPet = p.petName.trim().toLowerCase() === cleanPet;
      const matchCustomer = customerName ? p.customerName.trim().toLowerCase().includes(customerName.trim().toLowerCase()) : true;
      const notExpired = p.expirationDate >= today;
      const hasCredits = (p.totalBaths - p.usedBaths > 0) || (p.totalGrooms - p.usedGrooms > 0);
      return matchPet && matchCustomer && p.status === 'ativo' && notExpired && hasCredits;
    });
  }

  deletePackage(id: number): Observable<boolean> {
    return this.http.delete<boolean>(`/api/packages/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const filtered = this.packages$.getValue().filter(p => p.id !== id);
        this.savePackages(filtered);
      })
    );
  }
}
