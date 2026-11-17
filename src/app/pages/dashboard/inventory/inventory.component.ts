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
  filteredProducts: Product[] = [];
  editForms: ProductEditForm = {};
  editingId: number | null = null;
  savedId: number | null = null;
  showCreateForm = false;
  createForm: FormGroup;
  canManage = false;
  createPreview: string | null = null;
  uploadError = '';
  uploading = false;

  // HU-20 & HU-21: Filtros, KPIs e Entrada de Mercadoria
  activeFilter: 'all' | 'low' | 'out' = 'all';
  searchQuery = '';
  showRestockModal = false;
  restockForm: FormGroup;
  selectedProductForRestock: Product | null = null;
  restockSuccessMsg = '';

  constructor(
    private productService: ProductService,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.canManage = this.authService.canManageProducts();

    this.createForm = this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      costPrice: [null, [Validators.min(0)]],
      category: ['', Validators.required],
      description: [''],
      image: [''],
      stock: [0, [Validators.min(0)]],
      minStock: [5, [Validators.min(0)]],
      supplier: ['']
    });

    this.restockForm = this.fb.group({
      productId: [null, Validators.required],
      type: ['in', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      costPrice: [null, [Validators.min(0)]],
      supplier: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.productService.getProducts().pipe(takeUntil(this.destroy$)).subscribe(products => {
      this.products = [...products];
      this.applyFilters();
    });
  }

  // --- KPI Getters (HU-21) ---
  get totalProducts(): number {
    return this.products.length;
  }

  get lowStockProducts(): Product[] {
    return this.products.filter(p => {
      const min = p.minStock !== null && p.minStock !== undefined ? p.minStock : 5;
      return p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= min;
    });
  }

  get outOfStockProducts(): Product[] {
    return this.products.filter(p => p.stock !== null && p.stock !== undefined && p.stock === 0);
  }

  get totalInventoryCost(): number {
    return this.products.reduce((acc, p) => {
      const q = p.stock || 0;
      const c = p.costPrice || (p.price * 0.6);
      return acc + (q * c);
    }, 0);
  }

  setFilter(filter: 'all' | 'low' | 'out'): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    let list = [...this.products];

    // Filtro por Alerta de Estoque (HU-21)
    if (this.activeFilter === 'low') {
      list = list.filter(p => {
        const min = p.minStock !== null && p.minStock !== undefined ? p.minStock : 5;
        return p.stock !== null && p.stock !== undefined && p.stock > 0 && p.stock <= min;
      });
    } else if (this.activeFilter === 'out') {
      list = list.filter(p => p.stock !== null && p.stock !== undefined && p.stock === 0);
    }

    // Busca textual
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.supplier && p.supplier.toLowerCase().includes(q))
      );
    }

    this.filteredProducts = list;
  }

  isLowStock(p: Product): boolean {
    if (p.stock === null || p.stock === undefined || p.stock === 0) return false;
    const min = p.minStock !== null && p.minStock !== undefined ? p.minStock : 5;
    return p.stock <= min;
  }

  isOutOfStock(p: Product): boolean {
    return p.stock !== null && p.stock !== undefined && p.stock === 0;
  }

  // --- Modal de Entrada de Mercadoria (HU-20) ---
  openRestock(product?: Product): void {
    if (!this.canManage) return;
    this.selectedProductForRestock = product || null;
    this.restockForm.reset({
      productId: product ? product.id : (this.products.length ? this.products[0].id : null),
      type: 'in',
      quantity: 10,
      costPrice: product?.costPrice || null,
      supplier: product?.supplier || '',
      notes: ''
    });
    this.showRestockModal = true;
    this.restockSuccessMsg = '';
  }

  onRestockProductChange(): void {
    const pId = Number(this.restockForm.get('productId')?.value);
    const prod = this.products.find(p => p.id === pId);
    if (prod) {
      this.selectedProductForRestock = prod;
      if (prod.costPrice) {
        this.restockForm.patchValue({ costPrice: prod.costPrice, supplier: prod.supplier || '' });
      }
    }
  }

  closeRestock(): void {
    this.showRestockModal = false;
    this.selectedProductForRestock = null;
  }

  submitRestock(): void {
    if (this.restockForm.invalid || !this.canManage) return;
    const val = this.restockForm.value;
    const pId = Number(val.productId);
    const qty = Number(val.quantity);
    const type = val.type as 'in' | 'adjust' | 'initial';
    const cost = val.costPrice ? Number(val.costPrice) : undefined;
    const supplier = val.supplier || undefined;
    const notes = val.notes || undefined;

    this.productService.restock(pId, qty, type, supplier, cost, notes).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (updatedProd) => {
        this.restockSuccessMsg = `Entrada registrada! Estoque de "${updatedProd.name}" agora é ${updatedProd.stock} un.`;
        setTimeout(() => {
          this.closeRestock();
          this.restockSuccessMsg = '';
        }, 1600);
      },
      error: () => {
        alert('Erro ao registrar entrada de mercadoria.');
      }
    });
  }

  // --- CRUD Edição & Criação de Produtos ---
  startEdit(product: Product): void {
    if (!this.canManage) return;
    this.editingId = product.id;
    this.editForms[product.id] = this.fb.group({
      name: [product.name, [Validators.required]],
      price: [product.price, [Validators.required, Validators.min(0)]],
      costPrice: [product.costPrice ?? null, [Validators.min(0)]],
      category: [product.category, [Validators.required]],
      image: [product.image || ''],
      stock: [product.stock ?? null, [Validators.min(0)]],
      minStock: [product.minStock ?? 5, [Validators.min(0)]],
      supplier: [product.supplier || '']
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
      const minStock = values.minStock === null || values.minStock === '' ? 5 : Math.max(0, Math.floor(+values.minStock));
      const costPrice = values.costPrice === null || values.costPrice === '' ? null : Math.max(0, +values.costPrice);

      this.productService.update({
        ...product,
        name: values.name,
        price,
        costPrice,
        category: values.category,
        image: values.image || product.image,
        stock: isNaN(stock as number) ? null : stock,
        minStock: isNaN(minStock as number) ? 5 : minStock,
        supplier: values.supplier || ''
      }).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.editingId = null;
        this.editForms = {};
        this.savedId = product.id;
        setTimeout(() => this.savedId = null, 2000);
      });
    }
  }

  openCreate(): void {
    if (!this.canManage) return;
    this.createForm.reset({
      name: '',
      price: 0,
      costPrice: null,
      category: '',
      description: '',
      image: '',
      stock: 10,
      minStock: 5,
      supplier: ''
    });
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
    const minStock = values.minStock === null || values.minStock === '' ? 5 : Math.max(0, Math.floor(+values.minStock));
    const costPrice = values.costPrice === null || values.costPrice === '' ? null : Math.max(0, +values.costPrice);

    this.productService.create({
      name: values.name,
      price: Number(values.price),
      costPrice,
      rating: 0,
      reviews: 0,
      image: values.image || '',
      category: values.category,
      description: values.description || '',
      stock: isNaN(stock as number) ? null : stock,
      minStock: isNaN(minStock as number) ? 5 : minStock,
      supplier: values.supplier || ''
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
    if (!file) return;

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

  formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '0,00';
    return value.toFixed(2).replace('.', ',');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
