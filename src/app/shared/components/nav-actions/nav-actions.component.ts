import { Component, OnInit, OnDestroy, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
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
  selector: 'app-nav-actions',
  templateUrl: './nav-actions.component.html',
  styleUrls: ['./nav-actions.component.scss']
})
export class NavActionsComponent implements OnInit, OnDestroy {
  @Output() actionClicked = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  cartCount$!: Observable<number>;
  currentUser$!: Observable<User | null>;

  isStaff = false;
  notifOpen = false;
  userMenuOpen = false;
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
    this.cartCount$ = this.cartService.count$;
    this.currentUser$ = this.authService.currentUser$;

    this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isStaff = !!user && user.role !== 'customer';
      this.notifOpen = false;
      this.userMenuOpen = false;
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
    if (this.notifOpen) {
      this.userMenuOpen = false;
    }
  }

  closeNotif(): void {
    this.notifOpen = false;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
    if (this.userMenuOpen) {
      this.notifOpen = false;
    }
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  getInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getRoleLabel(role?: string): string {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'collaborator': return 'Colaborador';
      case 'customer': return 'Cliente';
      default: return 'Usuário';
    }
  }

  onAction(): void {
    this.closeNotif();
    this.closeUserMenu();
    this.actionClicked.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.notifOpen = false;
    this.userMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.notifOpen && !this.el.nativeElement.querySelector('.notif')?.contains(target)) {
      this.notifOpen = false;
    }
    if (this.userMenuOpen && !this.el.nativeElement.querySelector('.user-menu-wrapper')?.contains(target)) {
      this.userMenuOpen = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout(): void {
    this.authService.logout();
    this.onAction();
    this.router.navigate(['/login']);
  }
}
