import { Component, OnDestroy } from '@angular/core';
import { User } from '../../shared/services/auth.service';
import { AuthService } from '../../shared/services/auth.service';
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

  // Controle de expansão/colapso dos setores com setas
  sections: Record<string, boolean> = {
    visaoGeral: true,
    atendimento: true,
    clinica: true,
    cadastros: true,
    financeiro: true
  };

  toggleSection(key: string): void {
    this.sections[key] = !this.sections[key];
  }

  isSectionOpen(key: string): boolean {
    return this.sections[key] !== false;
  }

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
