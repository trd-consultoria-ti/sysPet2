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

  addToCart(): void {
    this.cartService.add(this.product);
  }
}
