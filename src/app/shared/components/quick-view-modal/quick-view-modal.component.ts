import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Product } from 'src/app/shared/models/product.model';
import { CartService } from 'src/app/shared/services/cart.service';

@Component({
  selector: 'app-quick-view-modal',
  templateUrl: './quick-view-modal.component.html',
  styleUrls: ['./quick-view-modal.component.scss']
})
export class QuickViewModalComponent {
  @Input() product: Product | null = null;
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  quantity: number = 1;

  constructor(private cartService: CartService) { }

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
