import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CashService, CashMovement } from '../../../shared/services/cash.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-cash',
  templateUrl: './admin-cash.component.html',
  styleUrls: ['./admin-cash.component.scss']
})
export class AdminCashComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  movements: CashMovement[] = [];
  showForm = false;
  movementForm: FormGroup;

  constructor(private fb: FormBuilder, private cashService: CashService) {
    this.movementForm = this.fb.group({
      type: ['entrada', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['']
    });
  }

  ngOnInit(): void {
    this.cashService.list().pipe(takeUntil(this.destroy$)).subscribe(m => this.movements = m);
  }

  get balance(): number {
    return this.movements.reduce(
      (sum, m) => sum + (m.type === 'entrada' ? m.amount : -m.amount), 0
    );
  }

  openCreate(): void {
    this.movementForm.reset({ type: 'entrada', description: '', amount: 0, paymentMethod: '' });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.movementForm.invalid) return;
    const v = this.movementForm.value;
    this.cashService.register({
      type: v.type,
      description: v.description,
      amount: Number(v.amount),
      paymentMethod: v.paymentMethod || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe(() => this.showForm = false);
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
