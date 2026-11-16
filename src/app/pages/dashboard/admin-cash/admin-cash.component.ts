import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  originSource: string | null = null;
  originDetails: { petName?: string; customerName?: string; serviceName?: string } = {};

  constructor(
    private fb: FormBuilder,
    private cashService: CashService,
    private route: ActivatedRoute
  ) {
    this.movementForm = this.fb.group({
      type: ['entrada', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['']
    });
  }

  ngOnInit(): void {
    this.cashService.list().pipe(takeUntil(this.destroy$)).subscribe(m => this.movements = m);

    // Identifica se veio de encaminhamento de Esteira de Delivery ou outro módulo
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params.amount || params.description) {
        this.originSource = params.source || null;
        this.originDetails = {
          petName: params.petName || '',
          customerName: params.customerName || '',
          serviceName: params.serviceName || ''
        };
        this.movementForm.patchValue({
          type: 'entrada',
          description: params.description || `Atendimento — Pet ${params.petName || ''} (${params.customerName || ''})`,
          amount: Number(params.amount) || 0,
          paymentMethod: params.paymentMethod || 'pix'
        });
        this.showForm = true;
      }
    });
  }

  get balance(): number {
    return this.movements.reduce(
      (sum, m) => sum + (m.type === 'entrada' ? m.amount : -m.amount), 0
    );
  }

  openCreate(): void {
    this.originSource = null;
    this.originDetails = {};
    this.movementForm.reset({ type: 'entrada', description: '', amount: 0, paymentMethod: '' });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.originSource = null;
    this.originDetails = {};
  }

  save(): void {
    if (this.movementForm.invalid) return;
    const v = this.movementForm.value;
    this.cashService.register({
      type: v.type,
      description: v.description,
      amount: Number(v.amount),
      paymentMethod: v.paymentMethod || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showForm = false;
      this.originSource = null;
      this.originDetails = {};
    });
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
