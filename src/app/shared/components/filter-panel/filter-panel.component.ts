import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-filter-panel',
  templateUrl: './filter-panel.component.html',
  styleUrls: ['./filter-panel.component.scss']
})
export class FilterPanelComponent implements OnInit {
  @Input() activeCategory: string = 'Todos';
  @Input() categories: string[] = [];
  @Input() showDurationFilter: boolean = false;
  @Input() minPrice: number = 0;
  @Input() maxPrice: number = 300;
  
  @Output() categoryChange = new EventEmitter<string>();
  @Output() priceRangeChange = new EventEmitter<number>();
  @Output() ratingFilterChange = new EventEmitter<number[]>();
  @Output() durationFilterChange = new EventEmitter<string[]>();

  selectedPrice: number = 300;
  selectedRatings: number[] = [];
  selectedDurations: string[] = [];
  
  ratingOptions = [5, 4, 3, 2, 1];
  durationOptions = ['30 min', '1 hora', '2 horas', '3+ horas'];

  constructor() { }

  ngOnInit(): void {
    this.selectedPrice = this.maxPrice;
  }

  onCategoryChange(category: string): void {
    if (this.activeCategory === category) {
      return;
    }
    this.activeCategory = category;
    this.categoryChange.emit(category);
  }

  onPriceSliderChange(price: number): void {
    this.selectedPrice = price;
    this.priceRangeChange.emit(price);
  }

  onPriceChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onPriceSliderChange(Number(input.value));
  }

  onRatingFilterChange(ratings: number[]): void {
    this.selectedRatings = ratings;
    this.ratingFilterChange.emit(ratings);
  }

  onDurationFilterChange(durations: string[]): void {
    this.selectedDurations = durations;
    this.durationFilterChange.emit(durations);
  }

  onRatingChange(rating: number): void {
    const index = this.selectedRatings.indexOf(rating);
    if (index === -1) {
      this.selectedRatings.push(rating);
    } else {
      this.selectedRatings.splice(index, 1);
    }
    this.ratingFilterChange.emit(this.selectedRatings);
  }

  onDurationChange(duration: string): void {
    const index = this.selectedDurations.indexOf(duration);
    if (index === -1) {
      this.selectedDurations.push(duration);
    } else {
      this.selectedDurations.splice(index, 1);
    }
    this.durationFilterChange.emit(this.selectedDurations);
  }

  isRatingSelected(rating: number): boolean {
    return this.selectedRatings.includes(rating);
  }

  isDurationSelected(duration: string): boolean {
    return this.selectedDurations.includes(duration);
  }
}
