import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-duration-filter',
  templateUrl: './duration-filter.component.html',
  styleUrls: ['./duration-filter.component.scss']
})
export class DurationFilterComponent {
  @Input() durationOptions: string[] = ['30 min', '1 hora', '2 horas', '3+ horas'];
  @Input() selectedDurations: string[] = [];
  @Output() durationChange = new EventEmitter<string[]>();

  isSelected(duration: string): boolean {
    return this.selectedDurations.includes(duration);
  }

  onToggle(duration: string): void {
    const index = this.selectedDurations.indexOf(duration);
    if (index === -1) {
      this.selectedDurations.push(duration);
    } else {
      this.selectedDurations.splice(index, 1);
    }
    this.durationChange.emit(this.selectedDurations);
  }
}
