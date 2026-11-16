import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-rating-filter',
  templateUrl: './rating-filter.component.html',
  styleUrls: ['./rating-filter.component.scss']
})
export class RatingFilterComponent {
  @Input() ratingOptions: number[] = [5, 4, 3, 2, 1];
  @Input() selectedRatings: number[] = [];
  @Output() ratingChange = new EventEmitter<number[]>();

  isSelected(rating: number): boolean {
    return this.selectedRatings.includes(rating);
  }

  onToggle(rating: number): void {
    const index = this.selectedRatings.indexOf(rating);
    if (index === -1) {
      this.selectedRatings.push(rating);
    } else {
      this.selectedRatings.splice(index, 1);
    }
    this.ratingChange.emit(this.selectedRatings);
  }
}
