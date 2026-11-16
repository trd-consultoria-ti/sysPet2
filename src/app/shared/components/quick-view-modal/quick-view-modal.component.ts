import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Product } from 'src/app/shared/models/product.model';
import { CartService } from 'src/app/shared/services/cart.service';

@Component({
  selector: 'app-quick-view-modal',
  templateUrl: './quick-view-modal.component.html',
  styleUrls: ['./quick-view-modal.component.scss']
})
export class QuickViewModalComponent {
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
      setTimeout(() => this.dialogRef?.nativeElement.focus());
    } else {
      const wasVisible = this._visible;
      this._visible = value;
      if (wasVisible && !value) {
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible) {
      this.closeModal();
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
