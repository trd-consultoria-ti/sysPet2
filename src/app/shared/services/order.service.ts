import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Order, OrderStatus } from '../models/order.model';
import { CartItem } from '../models/cart-item.model';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private ordersSubject = new BehaviorSubject<Order[]>([]);
  public orders$ = this.ordersSubject.asObservable();
  private readonly url = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {
    this.http.get<Order[]>(this.url).subscribe({
      next: orders => this.ordersSubject.next(orders),
      error: err => console.error('Falha ao carregar pedidos', err)
    });
  }

  getOrders(): Observable<Order[]> {
    return this.orders$;
  }

  create(data: {
    customerName: string;
    email?: string;
    phone?: string;
    address?: string;
    paymentMethod?: string;
    items: CartItem[];
    userId?: number;
  }): Observable<Order> {
    return this.http.post<Order>(this.url, data).pipe(
      tap(created => this.ordersSubject.next([created, ...this.ordersSubject.value]))
    );
  }

  updateStatus(id: number, status: OrderStatus): Observable<Order> {
    return this.http.patch<Order>(`${this.url}/${id}/status`, { status }).pipe(
      tap(updated => {
        const list = this.ordersSubject.value.map(o => o.id === updated.id ? updated : o);
        this.ordersSubject.next(list);
      })
    );
  }
}
