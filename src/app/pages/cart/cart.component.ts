import { Component, OnInit } from '@angular/core';
import { CartItem } from '../../shared/models/cart-item.model';
import { CartService } from '../../shared/services/cart.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  total = 0;

  constructor(private cartService: CartService) { }

  ngOnInit(): void {
    this.cartService.items$.subscribe(items => {
      this.items = items;
      this.total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    });
  }

  increment(item: CartItem): void {
    this.cartService.setQuantity(item.productId, item.quantity + 1);
  }

  decrement(item: CartItem): void {
    this.cartService.setQuantity(item.productId, item.quantity - 1);
  }

  remove(item: CartItem): void {
    this.cartService.remove(item.productId);
  }

  itemTotal(item: CartItem): number {
    return item.price * item.quantity;
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
