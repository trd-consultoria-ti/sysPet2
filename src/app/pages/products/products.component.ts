import { Component, OnInit, OnDestroy } from '@angular/core';
import { Product } from 'src/app/shared/models/product.model';
import { ProductService } from 'src/app/shared/services/product.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-products',
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  searchQuery: string = '';
  activeCategory: string = 'Todos';
  sortOption: string = 'relevance';

  products: Product[] = [];

  // Variáveis para armazenar os filtros selecionados
  selectedPriceRange: number = 300;
  selectedRatings: number[] = [];

  get filteredProducts(): Product[] {
    return this.products.filter(product => {
      // Filtro por termo de busca
      const matchesSearch = this.searchQuery === '' || 
        product.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        product.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      // Filtro por categoria
      const matchesCategory = this.activeCategory === 'Todos' || product.category === this.activeCategory;
      
      // Filtro por preço
      const matchesPrice = product.price <= this.selectedPriceRange;
      
      // Filtro por avaliação
      const matchesRating = this.selectedRatings.length === 0 || 
        this.selectedRatings.some(rating => product.rating >= rating);
      
      return matchesSearch && matchesCategory && matchesPrice && matchesRating;
    });
  }

  constructor(private productService: ProductService) { }

  ngOnInit(): void {
    this.productService.getProducts().pipe(takeUntil(this.destroy$)).subscribe(products => {
      this.products = [...products];
    });
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  onCategoryChange(category: string): void {
    this.activeCategory = category;
  }

  onPriceRangeChange(price: number): void {
    this.selectedPriceRange = price;
  }

  onRatingFilterChange(ratings: number[]): void {
    this.selectedRatings = ratings;
  }

  onSortChange(): void {
    switch (this.sortOption) {
      case 'price-asc':
        this.products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        this.products.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        this.products.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        this.products.sort((a, b) => b.reviews - a.reviews);
        break;
      default:
        // Relevância (ordem original)
        this.products.sort((a, b) => a.id - b.id);
        break;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}