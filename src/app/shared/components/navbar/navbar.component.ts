import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, combineLatest, interval, Subscription } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { CartService } from '../../services/cart.service';
import { AuthService, User } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import { AppointmentService } from '../../services/appointment.service';
import { Order } from '../../models/order.model';
import { Appointment } from '../../models/appointment.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  isMenuOpen = false;
  isMobile = false;
  cartCount$!: Observable<number>;
  currentUser$!: Observable<User | null>;

  isStaff = false;
  notifOpen = false;
  pendingOrders: Order[] = [];
  pendingAppointments: Appointment[] = [];
  private pollSub?: Subscription;

  constructor(
    private router: Router,
    private cartService: CartService,
    private authService: AuthService,
    private orderService: OrderService,
    private appointmentService: AppointmentService
  ) {}

  get pendingCount(): number {
    return this.pendingOrders.length + this.pendingAppointments.length;
  }

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize.bind(this));
    this.cartCount$ = this.cartService.count$;
    this.currentUser$ = this.authService.currentUser$;

    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isStaff = !!user && user.role !== 'customer';
      this.notifOpen = false;
      this.pollSub?.unsubscribe();
      if (this.isStaff) {
        this.orderService.refresh();
        this.appointmentService.refresh();
        this.pollSub = interval(60000)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.orderService.refresh();
            this.appointmentService.refresh();
          });
      }
    });

    combineLatest([
      this.orderService.getOrders(),
      this.appointmentService.getAppointments()
    ]).pipe(
      map(([orders, appointments]) => ({
        orders: orders.filter(o => o.status === 'pendente'),
        appointments: appointments.filter(a => a.status === 'solicitado')
      })),
      takeUntil(this.destroy$)
    ).subscribe(({ orders, appointments }) => {
      this.pendingOrders = orders;
      this.pendingAppointments = appointments;
    });
  }

  toggleNotif(): void {
    this.notifOpen = !this.notifOpen;
  }

  closeNotif(): void {
    this.notifOpen = false;
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkScreenSize.bind(this));
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
