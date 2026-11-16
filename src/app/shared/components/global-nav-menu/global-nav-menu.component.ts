import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GlobalNavService } from '../../services/global-nav.service';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-global-nav-menu',
  templateUrl: './global-nav-menu.component.html',
  styleUrls: ['./global-nav-menu.component.scss']
})
export class GlobalNavMenuComponent implements OnInit, OnDestroy {
  isOpen = false;
  currentUser: User | null = null;
  private subs = new Subscription();

  // Controle de expansão/colapso dos setores por prioridade (inicia com todos recolhidos)
  sections: Record<string, boolean> = {
    atendimento: false,
    clinica: false,
    estoqueLoja: false,
    gestao: false,
    loja: false,
    acesso: false
  };

  constructor(
    private globalNavService: GlobalNavService,
    private authService: AuthService,
    private router: Router
  ) {}

  toggleSection(key: string): void {
    this.sections[key] = !this.sections[key];
  }

  isSectionOpen(key: string): boolean {
    return !!this.sections[key];
  }

  ngOnInit(): void {
    this.subs.add(
      this.globalNavService.isOpen$.subscribe(open => {
        this.isOpen = open;
      })
    );

    this.subs.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  get isStaff(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'collaborator';
  }

  navigate(path: string): void {
    this.globalNavService.close();
    this.router.navigateByUrl(path);
  }

  close(): void {
    this.globalNavService.close();
  }

  logout(): void {
    this.authService.logout();
    this.close();
    this.router.navigate(['/']);
  }
}
