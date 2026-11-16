import { Component, OnInit, OnDestroy } from '@angular/core';
import { Appointment, AppointmentStatus } from '../../../shared/models/appointment.model';
import { Order } from '../../../shared/models/order.model';
import { AppointmentService } from '../../../shared/services/appointment.service';
import { OrderService } from '../../../shared/services/order.service';
import { CustomerService } from '../../../shared/services/customer.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-home',
  templateUrl: './dashboard-home.component.html',
  styleUrls: ['../dashboard.component.scss']
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  totalCustomers = 0;
  totalAppointments = 0;
  todayAppointments: Appointment[] = [];
  totalOrders = 0;
  revenue = 0;
  recentOrders: Order[] = [];
  isAdmin = false;

  appointmentStatusLabels: Record<AppointmentStatus, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(
    private customerService: CustomerService,
    private appointmentService: AppointmentService,
    private orderService: OrderService,
    private authService: AuthService
  ) {
    this.isAdmin = this.authService.isAdmin();
  }

  ngOnInit(): void {
    this.customerService.getCustomers().pipe(takeUntil(this.destroy$)).subscribe(customers => {
      this.totalCustomers = customers.length;
    });

    this.appointmentService.getAppointments().pipe(takeUntil(this.destroy$)).subscribe((appointments: Appointment[]) => {
      this.totalAppointments = appointments.length;
      const today = new Date().toISOString().split('T')[0];
      this.todayAppointments = appointments
        .filter(a => a.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));
    });

    this.orderService.getOrders().pipe(takeUntil(this.destroy$)).subscribe((orders: Order[]) => {
      this.totalOrders = orders.length;
      this.revenue = orders
        .filter(o => o.status !== 'cancelado')
        .reduce((sum, o) => sum + o.total, 0);
      this.recentOrders = [...orders]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
    });
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
