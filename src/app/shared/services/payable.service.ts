import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Payable, PayableStatus, PayableCategory } from '../models/payable.model';
import { CashService } from './cash.service';

const STORAGE_KEY_PAYABLES = 'syspet_payables_v1';

const DEFAULT_PAYABLES: Payable[] = [
  {
    id: 1,
    description: 'Aluguel do Ponto Comercial — Riacho Fundo QC 3',
    amount: 2500.00,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString().split('T')[0],
    category: 'aluguel',
    supplier: 'Imobiliária Central DF',
    status: 'previsto',
    notes: 'Boleto mensal do imóvel',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    description: 'Fornecedor Premier Pet — Reposição de Rações e Sachês',
    amount: 1840.50,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().split('T')[0],
    category: 'fornecedor',
    supplier: 'Distribuidora Pet Brasil Ltda',
    status: 'previsto',
    notes: 'Nota Fiscal 48192',
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    description: 'Insumos de Banho & Tosa — Shampoos Hipoalergênicos e Toalhas',
    amount: 620.00,
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString().split('T')[0],
    category: 'insumo',
    supplier: 'PetCare Cosméticos',
    status: 'pago',
    paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    paymentMethod: 'pix',
    notes: 'Pago via Pix pelo celular da dona',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
  },
  {
    id: 4,
    description: 'Distribuidora Vet Farma — Antipulgas e Vermífugos',
    amount: 950.00,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString().split('T')[0],
    category: 'fornecedor',
    supplier: 'Vet Farma DF Distribuição',
    status: 'previsto',
    notes: 'Apoquel e Bravecto em estoque',
    createdAt: new Date().toISOString()
  }
];

@Injectable({
  providedIn: 'root'
})
export class PayableService {
  private payables$ = new BehaviorSubject<Payable[]>(this.loadPayables());

  constructor(
    private http: HttpClient,
    private cashService: CashService
  ) {
    this.refresh();
  }

  private loadPayables(): Payable[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PAYABLES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Erro ao ler payables do localStorage', e);
    }
    this.savePayables(DEFAULT_PAYABLES);
    return DEFAULT_PAYABLES;
  }

  private savePayables(list: Payable[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PAYABLES, JSON.stringify(list));
      this.payables$.next(list);
    } catch (e) {
      console.warn('Erro ao salvar payables no localStorage', e);
    }
  }

  getPayables(): Observable<Payable[]> {
    return this.http.get<Payable[]>('/api/payables').pipe(
      tap(list => this.savePayables(list)),
      catchError(() => this.payables$.asObservable())
    );
  }

  getPayablesSnapshot(): Payable[] {
    return this.payables$.getValue();
  }

  refresh(): void {
    this.http.get<Payable[]>('/api/payables').subscribe({
      next: (list) => this.savePayables(list),
      error: () => {}
    });
  }

  createPayable(data: Omit<Payable, 'id'>): Observable<Payable> {
    const nextId = this.payables$.getValue().length
      ? Math.max(...this.payables$.getValue().map(p => p.id)) + 1
      : 1;

    const newPayable: Payable = {
      ...data,
      id: nextId,
      amount: Number(data.amount) || 0,
      status: data.status || 'previsto',
      createdAt: new Date().toISOString()
    };

    return this.http.post<Payable>('/api/payables', newPayable).pipe(
      catchError(() => of(newPayable)),
      tap(created => {
        const current = this.payables$.getValue();
        this.savePayables([created, ...current]);
      })
    );
  }

  updatePayable(id: number, updates: Partial<Payable>): Observable<Payable> {
    return this.http.put<Payable>(`/api/payables/${id}`, updates).pipe(
      catchError(() => {
        const current = this.payables$.getValue();
        const existing = current.find(p => p.id === id);
        return of({ ...existing, ...updates, id } as Payable);
      }),
      tap(updated => {
        const current = this.payables$.getValue();
        const idx = current.findIndex(p => p.id === id);
        if (idx !== -1) {
          const list = [...current];
          list[idx] = updated;
          this.savePayables(list);
        }
      })
    );
  }

  /**
   * Baixa da conta a pagar com geração automática de saída no Caixa (HU-23)
   */
  markAsPaid(id: number, paymentMethod = 'pix'): Observable<Payable> {
    const current = this.payables$.getValue();
    const item = current.find(p => p.id === id);
    if (!item) return of({} as Payable);

    const paidAt = new Date().toISOString();

    // 1. Gera saída no caixa (HU-23)
    this.cashService.register({
      type: 'saida',
      amount: item.amount,
      description: `Pagamento [${item.category.toUpperCase()}]: ${item.description}`,
      paymentMethod
    }).subscribe();

    // 2. Atualiza status da conta para 'pago'
    return this.updatePayable(id, {
      status: 'pago',
      paidAt,
      paymentMethod
    });
  }

  deletePayable(id: number): Observable<boolean> {
    return this.http.delete<boolean>(`/api/payables/${id}`).pipe(
      catchError(() => of(true)),
      tap(() => {
        const current = this.payables$.getValue().filter(p => p.id !== id);
        this.savePayables(current);
      })
    );
  }
}
