import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Product } from 'src/app/shared/models/product.model';
import { Service } from 'src/app/shared/models/service.model';
import { CartService } from 'src/app/shared/services/cart.service';

export type ItemType = 'service' | 'product';

@Component({
  selector: 'app-item-card',
  templateUrl: './item-card.component.html',
  styleUrls: ['./item-card.component.scss']
})
export class ItemCardComponent {
  @Input() item!: Service | Product | any;
  @Input() type?: ItemType;

  @Output() action = new EventEmitter<any>();

  imageError = false;

  readonly defaultImage = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250" fill="%23f1f5f9"><rect width="100%" height="100%" fill="%23f8fafc"/><circle cx="200" cy="110" r="42" fill="%23cbd5e1"/><circle cx="162" cy="62" r="15" fill="%23cbd5e1"/><circle cx="238" cy="62" r="15" fill="%23cbd5e1"/><circle cx="135" cy="98" r="13" fill="%23cbd5e1"/><circle cx="265" cy="98" r="13" fill="%23cbd5e1"/><text x="200" y="190" font-family="sans-serif" font-size="14" fill="%2394a3b8" text-anchor="middle" font-weight="600">Animal World</text></svg>`;

  constructor(
    private router: Router,
    private cartService: CartService
  ) { }

  get displayImage(): string {
    return this.imageError || !this.item?.image ? this.defaultImage : this.item.image;
  }

  onImageError(): void {
    this.imageError = true;
  }

  get itemType(): ItemType {
    if (this.type) {
      return this.type;
    }
    if (this.item && ('duration' in this.item)) {
      return 'service';
    }
    return 'product';
  }

  get isService(): boolean {
    return this.itemType === 'service';
  }

  get isProduct(): boolean {
    return this.itemType === 'product';
  }

  get outOfStock(): boolean {
    return this.isProduct && this.item?.stock === 0;
  }

  get lowStock(): boolean {
    return this.isProduct && this.item?.stock !== null && this.item?.stock !== undefined
      && this.item.stock > 0 && this.item.stock <= 5;
  }

  handleAction(): void {
    if (this.isService) {
      this.router.navigate(['/appointments'], { queryParams: { serviceId: this.item.id } });
      this.action.emit(this.item);
    } else if (this.isProduct) {
      if (this.outOfStock) {
        return;
      }
      this.cartService.add(this.item as Product);
      this.action.emit(this.item);
    }
  }

  addServiceToCart(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!this.isService) return;
    this.cartService.addCustomItem({
      id: 5000 + this.item.id,
      name: `Serviço: ${this.item.name}`,
      price: this.item.price,
      image: this.displayImage,
      quantity: 1
    });
    this.action.emit({ type: 'added-to-cart', item: this.item });
  }
}
