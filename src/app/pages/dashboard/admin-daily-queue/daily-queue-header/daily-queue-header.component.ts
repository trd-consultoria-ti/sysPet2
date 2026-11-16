import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-daily-queue-header',
  templateUrl: './daily-queue-header.component.html',
  styleUrls: ['./daily-queue-header.component.scss']
})
export class DailyQueueHeaderComponent {
  @Input() title: string = 'Esteira de Produção — Banho & Tosa';
  @Input() subtitle: string = 'Quadro Kanban de produção: clique para avançar o pet de estágio ou arraste entre colunas';
  @Input() viewMode: 'kanban' | 'list' = 'kanban';
  @Input() currentDate: string = '';
  @Input() isFull: boolean = false;
  @Input() showViewToggle: boolean = true;
  @Input() showDateNavigator: boolean = true;
  @Input() showCheckinBtn: boolean = true;
  @Input() checkinBtnText: string = 'Novo Check-in (Balcão)';

  @Output() viewModeChange = new EventEmitter<'kanban' | 'list'>();
  @Output() dateChange = new EventEmitter<number>();
  @Output() todayClick = new EventEmitter<void>();
  @Output() checkinClick = new EventEmitter<void>();

  onViewModeSelect(mode: 'kanban' | 'list'): void {
    if (this.viewMode !== mode) {
      this.viewMode = mode;
      this.viewModeChange.emit(mode);
    }
  }

  onChangeDate(delta: number): void {
    this.dateChange.emit(delta);
  }

  onTodayClick(): void {
    this.todayClick.emit();
  }

  onCheckinClick(): void {
    this.checkinClick.emit();
  }
}
