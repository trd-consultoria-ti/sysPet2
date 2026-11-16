import { Component, OnDestroy } from '@angular/core';
import { User, AuthService } from '../../shared/services/auth.service';
import { GlobalNavService } from '../../shared/services/global-nav.service';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  user: User | null = null;
  isAdmin = false;

  constructor(
    private authService: AuthService,
    private globalNavService: GlobalNavService,
    private router: Router
  ) {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.user = user;
      this.isAdmin = user?.role === 'admin';
    });
  }

  openGlobalMenu(): void {
    this.globalNavService.open();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
