import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Animal World - Sistema de Gerenciamento Pet';
  isDashboard = false;
  private routerSub?: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateIsDashboard(this.router.url);

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateIsDashboard(event.urlAfterRedirects || event.url);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private updateIsDashboard(url?: string): void {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const cleanHash = hash.replace(/^#\/?/, '/');
    const cleanUrl = (url || '').replace(/^#\/?/, '/');
    this.isDashboard = cleanUrl.startsWith('/dashboard') || cleanHash.startsWith('/dashboard');
  }
}