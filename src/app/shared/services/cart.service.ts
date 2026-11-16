import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartItem } from '../models/cart-item.model';
import { Product } from '../models/product.model';

const STORAGE_KEY = 'cart';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private itemsSubject = new BehaviorSubject<CartItem[]>(this.load());
  public items$ = this.itemsSubject.asObservable();
  public count$ = this.items$.pipe(map(items => items.reduce((sum, i) => sum + i.quantity, 0)));
  public total$ = this.items$.pipe(map(items => items.reduce((sum, i) => sum + i.price * i.quantity, 0)));

  private load(): CartItem[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.itemsSubject.value));
  }

  add(product: Product, quantity: number = 1): void {
    const items = [...this.itemsSubject.value];
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity
      });
    }
    this.itemsSubject.next(items);
    this.persist();
  }

  addCustomItem(item: { id: number; name: string; price: number; image?: string; quantity?: number }): void {
    const items = [...this.itemsSubject.value];
    const existing = items.find(i => i.productId === item.id);
    if (existing) {
      existing.quantity += (item.quantity || 1);
    } else {
      items.push({
        productId: item.id,
        name: item.name,
        price: item.price,
        image: item.image || 'assets/images/logo.png',
        quantity: item.quantity || 1
      });
    }
    this.itemsSubject.next(items);
    this.persist();
  }

  remove(productId: number): void {
    this.itemsSubject.next(this.itemsSubject.value.filter(i => i.productId !== productId));
    this.persist();
  }

  setQuantity(productId: number, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    const items = this.itemsSubject.value.map(i => i.productId === productId ? { ...i, quantity } : i);
    this.itemsSubject.next(items);
    this.persist();
  }

  clear(): void {
    this.itemsSubject.next([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  getItems(): CartItem[] {
    return this.itemsSubject.value;
  }
}
