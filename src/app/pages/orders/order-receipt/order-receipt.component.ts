import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderService } from '../../../shared/services/order.service';
import { Order, OrderStatus } from '../../../shared/models/order.model';

@Component({
  selector: 'app-order-receipt',
  templateUrl: './order-receipt.component.html',
  styleUrls: ['./order-receipt.component.scss']
})
export class OrderReceiptComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  order: Order | null = null;
  notFound = false;
  loading = true;

  statusLabels: Record<OrderStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  paymentLabels: Record<string, string> = {
    pix: 'Pix',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    cash: 'Dinheiro na entrega'
  };

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) { }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.orderService.refresh();
    this.orderService.getOrders().pipe(takeUntil(this.destroy$)).subscribe(orders => {
      this.order = orders.find(o => o.id === id) || null;
      this.notFound = !this.order;
      this.loading = false;
    });
  }

  paymentLabel(method?: string): string {
    return method ? (this.paymentLabels[method] || method) : '—';
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  print(): void {
    window.print();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
