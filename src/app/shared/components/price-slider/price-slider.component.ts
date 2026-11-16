import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-price-slider',
  templateUrl: './price-slider.component.html',
  styleUrls: ['./price-slider.component.scss']
})
export class PriceSliderComponent {
  @Input() min: number = 0;
  @Input() max: number = 300;
  @Input() value: number = 300;
  @Input() label: string = 'Faixa de Preço';
  @Input() sliderId: string = 'price-range-slider';

  @Output() valueChange = new EventEmitter<number>();

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = Number(input.value);
    this.valueChange.emit(this.value);
  }
}
