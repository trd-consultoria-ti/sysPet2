import { Component, OnInit, OnDestroy } from '@angular/core';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { OrderService } from '../../shared/services/order.service';
import { AuthService } from '../../shared/services/auth.service';
import { AuditService, AuditEntry } from '../../shared/services/audit.service';
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

  auditOpen: Record<number, boolean> = {};
  auditEntries: Record<number, AuditEntry[]> = {};
  auditError: Record<number, string> = {};
  auditLoading: Record<number, boolean> = {};

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private auditService: AuditService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const isCustomer = user?.role === 'customer';
    this.isStaff = !!user && !isCustomer;

    this.orderService.refresh();
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

  toggleAudit(order: Order): void {
    if (!order.id) {
      return;
    }
    this.auditOpen[order.id] = !this.auditOpen[order.id];
    if (this.auditOpen[order.id] && !this.auditEntries[order.id]) {
      this.auditLoading[order.id] = true;
      this.auditService.list('orders', order.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: entries => {
          this.auditEntries[order.id!] = entries;
          this.auditLoading[order.id!] = false;
        },
        error: () => {
          this.auditError[order.id!] = 'Histórico indisponível no momento.';
          this.auditLoading[order.id!] = false;
        }
      });
    }
  }

  trackById(index: number, item: { id?: number }): number {
    return item.id ?? index;
  }

  trackByIndex(index: number): number {
    return index;
  }

  formatAuditDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  auditSummary(e: AuditEntry): string {
    const statusLabel = (s: unknown) => String(s || '');
    if (e.action === 'status' && e.oldData?.status !== undefined) {
      return `status: ${statusLabel(e.oldData?.status)} → ${statusLabel(e.newData?.status)}`;
    }
    if (e.newData?.orderNumber) return `pedido ${e.newData.orderNumber} criado`;
    if (e.action === 'create') return 'criado';
    if (e.action === 'update') return 'atualizado';
    if (e.action === 'delete') return 'excluído';
    return e.action;
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
