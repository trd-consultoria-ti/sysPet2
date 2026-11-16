import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Product } from '../../../shared/models/product.model';
import { ProductService } from '../../../shared/services/product.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface ProductEditForm {
  [key: number]: FormGroup;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  products: Product[] = [];
  editForms: ProductEditForm = {};
  editingId: number | null = null;
  savedId: number | null = null;
  showCreateForm = false;
  createForm: FormGroup;
  canManage = false;

  constructor(
    private productService: ProductService,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.canManage = this.authService.canManageProducts();
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      category: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.productService.getProducts().pipe(takeUntil(this.destroy$)).subscribe(products => {
      this.products = [...products];
    });
  }

  startEdit(product: Product): void {
    if (!this.canManage) return;
    this.editingId = product.id;
    this.editForms[product.id] = this.fb.group({
      name: [product.name, [Validators.required]],
      price: [product.price, [Validators.required, Validators.min(0)]],
      category: [product.category, [Validators.required]]
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editForms = {};
  }

  saveEdit(product: Product): void {
    if (!this.canManage) return;
    const form = this.editForms[product.id];
    if (form && form.valid) {
      const values = form.value;
      const price = +values.price;
      if (isNaN(price) || price < 0) {
        return;
      }
      this.productService.update({
        ...product,
        name: values.name,
        price,
        category: values.category
      }).pipe(takeUntil(this.destroy$)).subscribe();
      this.editingId = null;
      this.editForms = {};
      this.savedId = product.id;
      setTimeout(() => this.savedId = null, 2000);
    }
  }

  openCreate(): void {
    if (!this.canManage) return;
    this.createForm.reset({ name: '', price: 0, category: '', description: '' });
    this.showCreateForm = true;
  }

  cancelCreate(): void {
    this.showCreateForm = false;
  }

  saveCreate(): void {
    if (this.createForm.invalid || !this.canManage) return;
    const values = this.createForm.value;
    this.productService.create({
      name: values.name,
      price: Number(values.price),
      rating: 0,
      reviews: 0,
      image: '',
      category: values.category,
      description: values.description || ''
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showCreateForm = false;
    });
  }

  remove(product: Product): void {
    if (!this.canManage) return;
    if (confirm(`Excluir o produto "${product.name}"?`)) {
      this.productService.delete(product.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  ctrl(productId: number, name: string): FormControl {
    return this.editForms[productId].get(name) as FormControl;
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
