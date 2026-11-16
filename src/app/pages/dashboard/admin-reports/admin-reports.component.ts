import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ReportService, Report } from '../../../shared/services/report.service';

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss']
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  report: Report | null = null;
  loading = false;
  error = '';
  from = '';
  to = '';

  paymentLabels: Record<string, string> = {
    pix: 'Pix',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    cash: 'Dinheiro'
  };

  orderStatusLabels: Record<string, string> = {
    pendente: 'Pendente',
    pago: 'Pago',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  appointmentStatusLabels: Record<string, string> = {
    solicitado: 'Solicitado',
    confirmado: 'Confirmado',
    concluido: 'Concluído',
    cancelado: 'Cancelado'
  };

  constructor(private reportService: ReportService) {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.from = this.toIsoDate(first);
    this.to = this.toIsoDate(last);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.from || !this.to) {
      return;
    }
    this.loading = true;
    this.error = '';
    this.reportService.get(this.from, this.to)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: report => {
          this.report = report;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.error = 'Não foi possível carregar o balanço. Tente novamente.';
        }
      });
  }

  get ticketMedio(): number {
    return this.report && this.report.ordersCount > 0
      ? this.report.revenue / this.report.ordersCount
      : 0;
  }

  paymentLabel(method: string | null): string {
    return method ? (this.paymentLabels[method] || method) : '—';
  }

  statusLabel(map: Record<string, string>, status: string): string {
    return map[status] || status;
  }

  formatPrice(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  private toIsoDate(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
