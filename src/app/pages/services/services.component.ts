import { Component, OnInit, OnDestroy } from '@angular/core';
import { Service } from 'src/app/shared/models/service.model';
import { ServiceCatalogService } from 'src/app/shared/services/service-catalog.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  searchQuery: string = '';
  activeCategory: string = 'Todos';
  sortOption: string = 'relevance';

  services: Service[] = [];

  // Variáveis para armazenar os filtros selecionados
  selectedPriceRange: number = 300;
  selectedRatings: number[] = [];
  selectedDurations: string[] = [];

  get filteredServices(): Service[] {
    return this.services.filter(service => {
      // Filtro por termo de busca
      const matchesSearch = service.name.toLowerCase().includes(this.searchQuery.toLowerCase());

      // Filtro por categoria
      const matchesCategory = this.activeCategory === 'Todos' || service.category === this.activeCategory;

      // Filtro por preço
      const matchesPrice = service.price <= this.selectedPriceRange;

      // Filtro por avaliação
      const matchesRating = this.selectedRatings.length === 0 ||
        this.selectedRatings.some(rating => service.rating >= rating);

      // Filtro por duração
      const matchesDuration = this.selectedDurations.length === 0 ||
        this.selectedDurations.includes(service.duration);

      return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesDuration;
    });
  }

  constructor(private serviceCatalog: ServiceCatalogService) { }

  ngOnInit(): void {
    this.serviceCatalog.getServices().pipe(takeUntil(this.destroy$)).subscribe(services => {
      this.services = [...services];
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

  onDurationFilterChange(durations: string[]): void {
    this.selectedDurations = durations;
  }

  onSortChange(): void {
    switch (this.sortOption) {
      case 'price-asc':
        this.services.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        this.services.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        this.services.sort((a, b) => b.rating - a.rating);
        break;
      case 'popular':
        this.services.sort((a, b) => b.reviews - a.reviews);
        break;
      default:
        // Relevância (ordem original)
        this.services.sort((a, b) => a.id - b.id);
        break;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
