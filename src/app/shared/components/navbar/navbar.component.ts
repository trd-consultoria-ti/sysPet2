import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CartService } from '../../services/cart.service';
import { AuthService, User } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { Order } from '../../models/order.model';
import { Appointment } from '../../models/appointment.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private resizeHandler = () => this.checkScreenSize();
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
    private http: HttpClient,
    private el: ElementRef<HTMLElement>
  ) {}

  get pendingCount(): number {
    return this.pendingOrders.length + this.pendingAppointments.length;
  }

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', this.resizeHandler);
    this.cartCount$ = this.cartService.count$;
    this.currentUser$ = this.authService.currentUser$;

    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isStaff = !!user && user.role !== 'customer';
      this.notifOpen = false;
      this.pollSub?.unsubscribe();
      if (!this.isStaff) {
        this.pendingOrders = [];
        this.pendingAppointments = [];
        return;
      }
      this.loadPending();
      this.pollSub = interval(60000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadPending());
    });
  }

  // Sino de pendências: fetch direto e somente para staff — não injeta OrderService/
  // AppointmentService aqui para não disparar GETs 401 no bootstrap anônimo
  private loadPending(): void {
    this.http.get<Order[]>(`${environment.apiUrl}/orders`).pipe(takeUntil(this.destroy$)).subscribe({
      next: orders => this.pendingOrders = orders.filter(o => o.status === 'pendente'),
      error: () => {}
    });
    this.http.get<Appointment[]>(`${environment.apiUrl}/appointments`).pipe(takeUntil(this.destroy$)).subscribe({
      next: appointments => this.pendingAppointments = appointments.filter(a => a.status === 'solicitado'),
      error: () => {}
    });
  }

  toggleNotif(): void {
    this.notifOpen = !this.notifOpen;
  }

  closeNotif(): void {
    this.notifOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.notifOpen = false;
    this.isMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.notifOpen && !this.el.nativeElement.querySelector('.notif')?.contains(event.target as Node)) {
      this.notifOpen = false;
    }
  }

  trackById(index: number, item: { id?: number }): number {
    return item.id ?? index;
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkScreenSize(): void {
    this.isMobile = window.innerWidth < 992;
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
