import { Component, Input, OnInit } from '@angular/core';
import { Product } from 'src/app/shared/models/product.model';
import { CartService } from 'src/app/shared/services/cart.service';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent implements OnInit {
  @Input() product!: Product;

  constructor(private cartService: CartService) { }

  ngOnInit(): void {
  }

  get outOfStock(): boolean {
    return this.product.stock === 0;
  }

  get lowStock(): boolean {
    return this.product.stock !== null && this.product.stock !== undefined
      && this.product.stock > 0 && this.product.stock <= 5;
  }

  addToCart(): void {
    if (this.outOfStock) {
      return;
    }
    this.cartService.add(this.product);
  }
}
