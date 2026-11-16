import { Component, Input, Output, EventEmitter } from '@angular/core';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'outline-primary' 
  | 'outline-secondary' 
  | 'danger' 
  | 'outline-danger' 
  | 'success' 
  | 'outline-success' 
  | 'whatsapp';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss']
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() icon?: string;
  @Input() iconPosition: 'left' | 'right' = 'left';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() block: boolean = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() ariaLabel?: string;
  @Input() title?: string;

  @Output() btnClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.btnClick.emit(event);
    }
  }

  get buttonClasses(): string[] {
    const classes = ['btn', `btn-${this.variant}`];
    if (this.size && this.size !== 'md') {
      classes.push(`btn-${this.size}`);
    }
    if (this.block) {
      classes.push('btn-block');
    }
    if (this.loading) {
      classes.push('btn-loading');
    }
    return classes;
  }
}
