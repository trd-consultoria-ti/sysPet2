import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener, OnDestroy } from '@angular/core';
import { Product } from 'src/app/shared/models/product.model';
import { CartService } from 'src/app/shared/services/cart.service';

@Component({
  selector: 'app-quick-view-modal',
  templateUrl: './quick-view-modal.component.html',
  styleUrls: ['./quick-view-modal.component.scss']
})
export class QuickViewModalComponent implements OnDestroy {
  @Input() product: Product | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('dialog') dialogRef?: ElementRef<HTMLElement>;

  private _visible = false;
  private previouslyFocused: HTMLElement | null = null;

  @Input()
  set visible(value: boolean) {
    if (value && !this._visible) {
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      this._visible = true;
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const closeBtn = this.dialogRef?.nativeElement.querySelector('.modal-close') as HTMLElement | null;
        if (closeBtn) {
          closeBtn.focus();
        } else {
          this.dialogRef?.nativeElement.focus();
        }
      });
    } else {
      const wasVisible = this._visible;
      this._visible = value;
      if (wasVisible && !value) {
        document.body.style.overflow = '';
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
      }
    }
  }
  get visible(): boolean {
    return this._visible;
  }

  quantity: number = 1;

  constructor(private cartService: CartService) { }

  ngOnDestroy(): void {
    if (this._visible) {
      document.body.style.overflow = '';
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (this.visible) {
      event.preventDefault();
      this.closeModal();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.visible || event.key !== 'Tab' || !this.dialogRef) {
      return;
    }

    const focusableElements = this.dialogRef.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement || document.activeElement === this.dialogRef.nativeElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  incrementQuantity(): void {
    this.quantity++;
  }

  decrementQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (this.product) {
      this.cartService.add(this.product, this.quantity);
    }
    this.closeModal();
  }
}
