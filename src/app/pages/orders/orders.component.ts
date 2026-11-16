import { Component, OnInit, OnDestroy } from '@angular/core';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { OrderService } from '../../shared/services/order.service';
import { AuthService } from '../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  orders: Order[] = [];
  isStaff = false;

  statusLabels: Record<OrderStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  statusOptions: OrderStatus[] = ['pendente', 'pago', 'entregue', 'cancelado'];

  constructor(
    private orderService: OrderService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const isCustomer = user?.role === 'customer';
    this.isStaff = !!user && !isCustomer;

    this.orderService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      const visible = isCustomer ? orders.filter(o => o.userId === user?.id) : orders;
      this.orders = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  setStatus(order: Order, event: Event): void {
    const status = (event.target as HTMLSelectElement).value as OrderStatus;
    if (order.id && status !== order.status) {
      this.orderService.updateStatus(order.id, status).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  itemCount(order: Order): number {
    return order.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
