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
  createPreview: string | null = null;
  uploadError = '';
  uploading = false;

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
      description: [''],
      image: [''],
      stock: [null, [Validators.min(0)]]
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
      category: [product.category, [Validators.required]],
      image: [product.image || ''],
      stock: [product.stock ?? null, [Validators.min(0)]]
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
      const stock = values.stock === null || values.stock === '' ? null : Math.max(0, Math.floor(+values.stock));
      this.productService.update({
        ...product,
        name: values.name,
        price,
        category: values.category,
        image: values.image || product.image,
        stock: isNaN(stock as number) ? null : stock
      }).pipe(takeUntil(this.destroy$)).subscribe();
      this.editingId = null;
      this.editForms = {};
      this.savedId = product.id;
      setTimeout(() => this.savedId = null, 2000);
    }
  }

  openCreate(): void {
    if (!this.canManage) return;
    this.createForm.reset({ name: '', price: 0, category: '', description: '', image: '', stock: null });
    this.createPreview = null;
    this.uploadError = '';
    this.showCreateForm = true;
  }

  cancelCreate(): void {
    this.showCreateForm = false;
  }

  saveCreate(): void {
    if (this.createForm.invalid || !this.canManage) return;
    const values = this.createForm.value;
    const stock = values.stock === null || values.stock === '' ? null : Math.max(0, Math.floor(+values.stock));
    this.productService.create({
      name: values.name,
      price: Number(values.price),
      rating: 0,
      reviews: 0,
      image: values.image || '',
      category: values.category,
      description: values.description || '',
      stock: isNaN(stock as number) ? null : stock
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showCreateForm = false;
    });
  }

  onImageUrlChange(): void {
    const url = this.createForm.get('image')?.value;
    this.createPreview = url || null;
  }

  onFileSelected(event: Event, target: 'create' | number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    // Validação client-side: tipo e tamanho antes de gastar upload
    if (!file.type.startsWith('image/')) {
      this.uploadError = 'O arquivo precisa ser uma imagem.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'Imagem maior que 5MB.';
      input.value = '';
      return;
    }
    this.uploadError = '';
    this.uploading = true;

    const reader = new FileReader();
    reader.onload = () => {
      if (target === 'create') {
        this.createPreview = reader.result as string;
      }
    };
    reader.readAsDataURL(file);

    this.productService.uploadImage(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.uploading = false;
        if (target === 'create') {
          this.createForm.patchValue({ image: res.url });
          this.createPreview = res.url;
        } else {
          this.editForms[target]?.patchValue({ image: res.url });
        }
      },
      error: () => {
        this.uploading = false;
        // Falha no upload não pode deixar preview fingindo sucesso
        if (target === 'create') this.createPreview = null;
        this.editForms[target === 'create' ? -1 : target]?.patchValue({ image: '' });
        this.uploadError = 'Falha no upload — use uma URL de imagem.';
      }
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
