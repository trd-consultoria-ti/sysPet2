import { Component, OnInit, OnDestroy } from '@angular/core';
import { CartItem } from '../../shared/models/cart-item.model';
import { CartService } from '../../shared/services/cart.service';
import { ProductService } from '../../shared/services/product.service';
import { ServiceCatalogService } from '../../shared/services/service-catalog.service';
import { MedicationService } from '../../shared/services/medication.service';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface CatalogItem {
  id: number;
  type: 'produto' | 'servico' | 'medicamento';
  name: string;
  category: string;
  price: number;
  image: string;
  description?: string;
  subtitle?: string;
  stock?: number | null;
}

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss']
})
export class CartComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  items: CartItem[] = [];
  total = 0;

  // Catálogo unificado para adicionar ao carrinho
  catalogModalOpen = false;
  catalogSearch = '';
  activeFilter: 'todos' | 'produto' | 'servico' | 'medicamento' = 'todos';
  allCatalogItems: CatalogItem[] = [];
  feedbackMessage = '';

  constructor(
    private cartService: CartService,
    private productService: ProductService,
    private serviceCatalog: ServiceCatalogService,
    private medicationService: MedicationService
  ) { }

  ngOnInit(): void {
    this.cartService.items$.pipe(takeUntil(this.destroy$)).subscribe(items => {
      this.items = items;
      this.total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    });

    this.loadCatalog();
  }

  loadCatalog(): void {
    combineLatest([
      this.productService.getProducts(),
      this.serviceCatalog.getServices(),
      this.medicationService.list()
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([products, services, medications]) => {
        const prodItems: CatalogItem[] = (products || []).map(p => ({
          id: p.id,
          type: 'produto',
          name: p.name,
          category: p.category || 'Produtos',
          price: p.price,
          image: p.image || 'assets/images/logo.png',
          description: p.description,
          stock: p.stock
        }));

        const servItems: CatalogItem[] = (services || []).map(s => ({
          id: 5000 + s.id,
          type: 'servico',
          name: `Serviço: ${s.name}`,
          category: s.category || 'Estética & Saúde',
          price: s.price,
          image: s.image || 'assets/images/logo.png',
          description: s.description,
          subtitle: s.duration ? `Duração: ${s.duration}` : undefined
        }));

        const medItems: CatalogItem[] = (medications || []).map(m => ({
          id: 8000 + m.id,
          type: 'medicamento',
          name: `Medicamento: ${m.name}`,
          category: m.category || 'Farmácia Veterinária',
          price: m.price || 0,
          image: 'assets/images/logo.png',
          description: m.activePrinciple ? `Princípio: ${m.activePrinciple} - ${m.presentation}` : m.presentation,
          subtitle: m.concentration ? `Concentração: ${m.concentration}` : undefined,
          stock: m.stock
        }));

        this.allCatalogItems = [...prodItems, ...servItems, ...medItems];
      },
      error: err => console.error('Erro ao carregar catálogo unificado', err)
    });
  }

  openCatalogModal(): void {
    this.catalogModalOpen = true;
    this.catalogSearch = '';
    this.activeFilter = 'todos';
  }

  closeCatalogModal(): void {
    this.catalogModalOpen = false;
  }

  get filteredCatalogItems(): CatalogItem[] {
    const term = (this.catalogSearch || '').toLowerCase().trim();
    return this.allCatalogItems.filter(item => {
      const matchesType = this.activeFilter === 'todos' || item.type === this.activeFilter;
      if (!matchesType) return false;

      if (!term) return true;
      const matchName = item.name.toLowerCase().includes(term);
      const matchCat = (item.category || '').toLowerCase().includes(term);
      const matchDesc = (item.description || '').toLowerCase().includes(term);
      return matchName || matchCat || matchDesc;
    });
  }

  getCountByType(type: 'todos' | 'produto' | 'servico' | 'medicamento'): number {
    if (type === 'todos') return this.allCatalogItems.length;
    return this.allCatalogItems.filter(i => i.type === type).length;
  }

  getItemCartCount(id: number): number {
    const found = this.items.find(i => i.productId === id);
    return found ? found.quantity : 0;
  }

  addCatalogItem(item: CatalogItem): void {
    this.cartService.addCustomItem({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: 1
    });

    this.feedbackMessage = `"${item.name}" adicionado ao carrinho!`;
    setTimeout(() => {
      if (this.feedbackMessage.includes(item.name)) {
        this.feedbackMessage = '';
      }
    }, 2500);
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
    return (value || 0).toFixed(2).replace('.', ',');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
