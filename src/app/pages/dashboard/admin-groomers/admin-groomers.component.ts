import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Groomer, GroomerCommissionReport, GroomerCommissionItem } from '../../../shared/models/groomer.model';
import { GroomerService } from '../../../shared/services/groomer.service';
import { DailyServicesService } from '../../../shared/services/daily-services.service';
import { DailyService } from '../../../shared/models/daily-service.model';
import { PayableService } from '../../../shared/services/payable.service';

@Component({
  selector: 'app-admin-groomers',
  templateUrl: './admin-groomers.component.html',
  styleUrls: ['./admin-groomers.component.scss']
})
export class AdminGroomersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Abas de navegação
  activeTab: 'groomers' | 'commissions' = 'groomers';

  // Lista de tosadores e formulário (HU-18)
  groomers: Groomer[] = [];
  showGroomerModal = false;
  editingGroomerId: number | null = null;
  groomerForm: FormGroup;
  toastMessage = '';
  toastType: 'success' | 'info' | 'warning' = 'info';

  // Relatório de Comissões (HU-19)
  allDailyServices: DailyService[] = [];
  commissionReports: GroomerCommissionReport[] = [];
  filteredReports: GroomerCommissionReport[] = [];
  selectedGroomerFilter: number | 'all' = 'all';

  // Filtros de Data
  startDate: string;
  endDate: string;

  // Lançamento em Contas a Pagar (integração HU-19 + HU-23)
  payingGroomerId: number | null = null;

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.showGroomerModal) this.closeGroomerModal();
  }

  constructor(
    private groomerService: GroomerService,
    private dailyService: DailyServicesService,
    private payableService: PayableService,
    private fb: FormBuilder
  ) {
    const today = new Date();
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.startDate = firstDayMonth.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];

    this.groomerForm = this.fb.group({
      name: ['', Validators.required],
      phone: ['', Validators.required],
      commissionRate: [15, [Validators.required, Validators.min(1), Validators.max(100)]],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.loadGroomers();
    this.loadDailyServices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Carregamento de Dados ---
  private loadGroomers(): void {
    this.groomerService.getGroomers().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.groomers = list || [];
      this.calculateCommissions();
    });
  }

  private loadDailyServices(): void {
    this.dailyService.queue$.pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.allDailyServices = res.items || [];
      this.calculateCommissions();
    });
  }

  // --- Gestão de Tosadores (HU-18) ---
  openNewGroomerModal(): void {
    this.editingGroomerId = null;
    this.groomerForm.reset({
      name: '',
      phone: '',
      commissionRate: 15,
      active: true
    });
    this.showGroomerModal = true;
  }

  openEditGroomerModal(g: Groomer): void {
    this.editingGroomerId = g.id;
    this.groomerForm.patchValue({
      name: g.name,
      phone: g.phone || '',
      commissionRate: g.commissionRate || 15,
      active: g.active !== false
    });
    this.showGroomerModal = true;
  }

  closeGroomerModal(): void {
    this.showGroomerModal = false;
    this.editingGroomerId = null;
  }

  saveGroomer(): void {
    if (this.groomerForm.invalid) {
      this.groomerForm.markAllAsTouched();
      return;
    }

    const val = this.groomerForm.value;
    if (this.editingGroomerId) {
      this.groomerService.updateGroomer(this.editingGroomerId, {
        name: val.name,
        phone: val.phone,
        commissionRate: Number(val.commissionRate),
        active: val.active
      }).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showToast('Tosador atualizado com sucesso!', 'success');
        this.closeGroomerModal();
      });
    } else {
      this.groomerService.addGroomer({
        name: val.name,
        phone: val.phone,
        commissionRate: Number(val.commissionRate),
        active: val.active !== false
      }).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showToast('Tosador cadastrado com sucesso!', 'success');
        this.closeGroomerModal();
      });
    }
  }

  toggleActive(g: Groomer): void {
    const nextState = !g.active;
    this.groomerService.updateGroomer(g.id, { active: nextState }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showToast(`Profissional ${g.name} ${nextState ? 'ativado' : 'desativado'}.`, 'info');
    });
  }

  deleteGroomer(g: Groomer): void {
    if (confirm(`Deseja realmente remover o tosador ${g.name}?`)) {
      this.groomerService.deleteGroomer(g.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showToast(`Tosador ${g.name} removido.`, 'info');
      });
    }
  }

  // --- Relatório de Comissões (HU-19) ---
  calculateCommissions(): void {
    this.commissionReports = this.groomerService.calculateCommissions(
      this.allDailyServices,
      this.startDate,
      this.endDate
    );
    this.applyCommissionFilter();
  }

  applyCommissionFilter(): void {
    if (this.selectedGroomerFilter === 'all') {
      this.filteredReports = [...this.commissionReports];
    } else {
      this.filteredReports = this.commissionReports.filter(r => r.groomerId === Number(this.selectedGroomerFilter));
    }
  }

  onDateFilterChange(): void {
    this.calculateCommissions();
  }

  onGroomerFilterChange(): void {
    this.applyCommissionFilter();
  }

  get totalCommissionDueOverall(): number {
    return this.filteredReports.reduce((acc, r) => acc + r.totalCommissionDue, 0);
  }

  get totalServiceRevenueOverall(): number {
    return this.filteredReports.reduce((acc, r) => acc + r.totalServiceRevenue, 0);
  }

  get totalServicesCountOverall(): number {
    return this.filteredReports.reduce((acc, r) => acc + r.totalServices, 0);
  }

  // Lança a comissão calculada diretamente no Contas a Pagar (HU-19 -> HU-23)
  launchToPayables(report: GroomerCommissionReport): void {
    if (report.totalCommissionDue <= 0) {
      this.showToast('Nenhuma comissão a pagar para este período.', 'warning');
      return;
    }

    if (!confirm(`Lançar R$ ${this.formatPrice(report.totalCommissionDue)} de comissão para ${report.groomerName} no Contas a Pagar?`)) {
      return;
    }

    const desc = `Comissão de Banho e Tosa — ${report.groomerName} (${this.formatDateShort(this.startDate)} a ${this.formatDateShort(this.endDate)})`;
    const dueDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().split('T')[0];

    this.payableService.createPayable({
      description: desc,
      amount: report.totalCommissionDue,
      dueDate,
      category: 'comissao',
      supplier: report.groomerName,
      status: 'previsto',
      notes: `Base de cálculo: ${report.totalServices} serviços somando R$ ${this.formatPrice(report.totalServiceRevenue)} (Rateio 15% solo / 7,5% dupla).`
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showToast(`Conta a pagar gerada com sucesso para ${report.groomerName}!`, 'success');
    });
  }

  openWhatsAppGroomer(g: Groomer | GroomerCommissionReport): void {
    const rawPhone = (g.phone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 11 ? '55' + rawPhone : (rawPhone.length === 13 ? rawPhone : '');
    const targetName = 'name' in g ? g.name : g.groomerName;
    const text = encodeURIComponent(
      `Olá ${targetName}! Segue o extrato de comissões Animal World no período de ${this.formatDateShort(this.startDate)} a ${this.formatDateShort(this.endDate)}.`
    );
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      this.showToast('Telefone inválido para WhatsApp', 'warning');
    }
  }

  formatPrice(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    return val.toFixed(2).replace('.', ',');
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }

  showToast(msg: string, type: 'success' | 'info' | 'warning' = 'info'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = '', 3500);
  }
}
