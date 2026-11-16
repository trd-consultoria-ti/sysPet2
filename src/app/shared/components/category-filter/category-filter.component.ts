import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-category-filter',
  templateUrl: './category-filter.component.html',
  styleUrls: ['./category-filter.component.scss']
})
export class CategoryFilterComponent {
  @Input() categories: string[] = [];
  @Input() activeCategory: string = 'Todos';
  @Output() categoryChange = new EventEmitter<string>();

  onSelect(category: string): void {
    if (this.activeCategory === category) {
      return;
    }
    this.activeCategory = category;
    this.categoryChange.emit(category);
  }
}
