import { Component } from '@angular/core';
import { User } from '../../shared/services/auth.service';
import { AuthService } from '../../shared/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  user: User | null = null;
  isAdmin = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      this.isAdmin = user?.role === 'admin';
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
