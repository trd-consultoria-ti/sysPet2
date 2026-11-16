import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CashMovement {
  id: number;
  orderId: number | null;
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
  paymentMethod: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashService {
  private url = `${environment.apiUrl}/cash`;
  private movementsSubject = new BehaviorSubject<CashMovement[]>([]);
  public movements$ = this.movementsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<CashMovement[]>(this.url).subscribe(m => this.movementsSubject.next(m));
  }

  list(): Observable<CashMovement[]> {
    return this.movements$;
  }

  register(data: { type: 'entrada' | 'saida'; description: string; amount: number; paymentMethod?: string }): Observable<CashMovement> {
    return this.http.post<CashMovement>(this.url, data).pipe(
      tap(m => this.movementsSubject.next([m, ...this.movementsSubject.value]))
    );
  }

  get balance(): number {
    return this.movementsSubject.value.reduce(
      (sum, m) => sum + (m.type === 'entrada' ? m.amount : -m.amount), 0
    );
  }
}
