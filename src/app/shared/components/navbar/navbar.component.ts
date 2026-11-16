import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  isMenuOpen = false;
  isMobile = false;
  cartCount$!: Observable<number>;
  currentUser$!: Observable<User | null>;

  constructor(
    private router: Router,
    private cartService: CartService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize.bind(this));
    this.cartCount$ = this.cartService.count$;
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.checkScreenSize.bind(this));
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
