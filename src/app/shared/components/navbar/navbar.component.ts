import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { GlobalNavService } from '../../services/global-nav.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private resizeHandler = () => this.checkScreenSize();
  isMenuOpen = false;
  isMobile = false;

  constructor(
    private router: Router,
    private globalNavService: GlobalNavService
  ) {}

  openGlobalMenu(): void {
    this.globalNavService.open();
  }

  ngOnInit(): void {
    this.checkScreenSize();
    window.addEventListener('resize', this.resizeHandler);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen = false;
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
  }

  checkScreenSize(): void {
    this.isMobile = window.innerWidth < 992;
    if (!this.isMobile) {
      this.isMenuOpen = false;
    }
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
}
