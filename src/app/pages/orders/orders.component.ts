import { Component, OnInit } from '@angular/core';
import { Order, OrderStatus } from '../../shared/models/order.model';
import { OrderService } from '../../shared/services/order.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss']
})
export class OrdersComponent implements OnInit {
  orders: Order[] = [];

  statusLabels: Record<OrderStatus, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  constructor(
    private orderService: OrderService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const isCustomer = user?.role === 'customer';

    this.orderService.getOrders().subscribe(orders => {
      const visible = isCustomer ? orders.filter(o => o.userId === user?.id) : orders;
      this.orders = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
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
}
