import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DailyServicesService } from '../../../shared/services/daily-services.service';
import { DailyService, DailyQueueStats, DailyServiceStatus, HealthChecklist } from '../../../shared/models/daily-service.model';
import { ServiceCatalogService } from '../../../shared/services/service-catalog.service';
import { Service } from '../../../shared/models/service.model';

export interface KanbanColumn {
  key: DailyServiceStatus;
  label: string;
  icon: string;
  actionLabel: string;
  badgeClass: string;
}

@Component({
  selector: 'app-admin-daily-queue',
  templateUrl: './admin-daily-queue.component.html',
  styleUrls: ['./admin-daily-queue.component.scss']
})
export class AdminDailyQueueComponent implements OnInit, OnDestroy {
  queueItems: DailyService[] = [];
  filteredItems: DailyService[] = [];
  stats: DailyQueueStats = {
    date: new Date().toISOString().split('T')[0],
    capacity: 50,
    totalToday: 0,
    waiting: 0,
    inProgress: 0,
    ready: 0,
    delivered: 0,
    canceled: 0,
    remainingSpots: 50,
    isFull: false
  };

  viewMode: 'kanban' | 'list' = 'kanban';
  currentDate: string = new Date().toISOString().split('T')[0];
  activeFilter: 'todos' | DailyServiceStatus = 'todos';
  availableServices: Service[] = [];

  readonly columns: KanbanColumn[] = [
    { key: 'aguardando', label: '1. Na Fila / Gaiola', icon: 'fas fa-clock', actionLabel: 'Iniciar Banho', badgeClass: 'waiting' },
    { key: 'em_atendimento', label: '2. Em Banho & Tosa', icon: 'fas fa-bath', actionLabel: 'Marcar Pronto', badgeClass: 'in-progress' },
    { key: 'pronto', label: '3. Pronto para Retirada', icon: 'fas fa-check-circle', actionLabel: 'Entregar ao Tutor', badgeClass: 'ready' },
    { key: 'entregue', label: '4. Entregue / Concluído', icon: 'fas fa-paw', actionLabel: '', badgeClass: 'delivered' }
  ];

  draggedItem: DailyService | null = null;
  dragOverColumn: DailyServiceStatus | null = null;

  showModal: boolean = false;
  isEditing: boolean = false;
  editingId: number | null = null;
  checkinForm!: FormGroup;

  toastMessage: string | null = null;
  toastType: 'success' | 'warning' | 'info' = 'info';

  private sub: Subscription = new Subscription();

  constructor(
    private dailyService: DailyServicesService,
    private catalogService: ServiceCatalogService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCatalog();

    this.sub.add(
      this.dailyService.queue$.subscribe(res => {
        this.queueItems = res.items || [];
        this.stats = res.stats;
        this.applyFilter();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private initForm(): void {
    this.checkinForm = this.fb.group({
      customerName: ['', Validators.required],
      phone: ['', Validators.required],
      petName: ['', Validators.required],
      petBreed: [''],
      serviceName: ['', Validators.required],
      estimatedPrice: [79.90, [Validators.required, Validators.min(0)]],
      cageNumber: [''],
      groomerName: [''],
      notes: [''],
      health_skin: [false],
      health_parasites: [false],
      health_paw: [false],
      health_vomiting: [false],
      health_malaise: [false],
      health_obs: [''],
      requiresValidation: [false],
      validationConfirmed: [true]
    });

    this.checkinForm.get('serviceName')?.valueChanges.subscribe(name => {
      const isTosa = String(name || '').toLowerCase().includes('tosa');
      if (isTosa) {
        this.checkinForm.patchValue({
          requiresValidation: true,
          validationConfirmed: false
        }, { emitEvent: false });
      }
    });
  }

  private loadCatalog(): void {
    this.catalogService.getServices().subscribe(services => {
      this.availableServices = services;
    });
  }

  onServiceSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const selectedName = select.value;
    const s = this.availableServices.find(srv => srv.name === selectedName);
    if (s) {
      this.checkinForm.patchValue({
        estimatedPrice: s.price,
        serviceName: s.name
      });
    }
  }

  changeDate(delta: number): void {
    const d = new Date(this.currentDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    this.currentDate = d.toISOString().split('T')[0];
    this.dailyService.refresh(this.currentDate).subscribe();
  }

  setToday(): void {
    this.currentDate = new Date().toISOString().split('T')[0];
    this.dailyService.refresh(this.currentDate).subscribe();
  }

  setFilter(filter: 'todos' | DailyServiceStatus): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (this.activeFilter === 'todos') {
      this.filteredItems = [...this.queueItems];
    } else {
      this.filteredItems = this.queueItems.filter(item => item.status === this.activeFilter);
    }
  }

  getItemsByStatus(status: DailyServiceStatus): DailyService[] {
    return this.queueItems.filter(item => item.status === status);
  }

  advanceStatus(item: DailyService): void {
    let next: DailyServiceStatus | null = null;
    if (item.status === 'aguardando') {
      next = 'em_atendimento';
    } else if (item.status === 'em_atendimento') {
      next = 'pronto';
    } else if (item.status === 'pronto') {
      next = 'entregue';
    }

    if (next) {
      this.changeStatus(item, next);
    }
  }

  regressStatus(item: DailyService): void {
    let prev: DailyServiceStatus | null = null;
    if (item.status === 'entregue') {
      prev = 'pronto';
    } else if (item.status === 'pronto') {
      prev = 'em_atendimento';
    } else if (item.status === 'em_atendimento') {
      prev = 'aguardando';
    }

    if (prev) {
      this.changeStatus(item, prev);
    }
  }

  // Drag and Drop
  onDragStart(event: DragEvent, item: DailyService): void {
    this.draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', String(item.id));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent, status: DailyServiceStatus): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverColumn = status;
  }

  onDragLeave(event: DragEvent): void {
    this.dragOverColumn = null;
  }

  onDrop(event: DragEvent, targetStatus: DailyServiceStatus): void {
    event.preventDefault();
    this.dragOverColumn = null;
    if (this.draggedItem && this.draggedItem.status !== targetStatus) {
      this.changeStatus(this.draggedItem, targetStatus);
    }
    this.draggedItem = null;
  }

  openCheckinModal(): void {
    this.isEditing = false;
    this.editingId = null;
    this.checkinForm.reset({
      customerName: '',
      phone: '',
      petName: '',
      petBreed: '',
      serviceName: this.availableServices[0]?.name || 'Banho Completo',
      estimatedPrice: this.availableServices[0]?.price || 79.90,
      cageNumber: '',
      groomerName: '',
      notes: '',
      health_skin: false,
      health_parasites: false,
      health_paw: false,
      health_vomiting: false,
      health_malaise: false,
      health_obs: '',
      requiresValidation: false,
      validationConfirmed: true
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveCheckin(): void {
    if (this.checkinForm.invalid) {
      this.checkinForm.markAllAsTouched();
      return;
    }

    const val = this.checkinForm.value;
    const healthChecklist: HealthChecklist = {
      skin_lesion: !!val.health_skin,
      parasites: !!val.health_parasites,
      paw_lesion: !!val.health_paw,
      vomiting_diarrhea: !!val.health_vomiting,
      general_malaise: !!val.health_malaise,
      observations: val.health_obs || ''
    };

    const payload: Partial<DailyService> = {
      customerName: val.customerName,
      phone: val.phone,
      petName: val.petName,
      petBreed: val.petBreed,
      serviceName: val.serviceName,
      estimatedPrice: val.estimatedPrice,
      cageNumber: val.cageNumber,
      groomerName: val.groomerName,
      notes: val.notes,
      healthChecklist,
      requiresValidation: val.requiresValidation,
      validationConfirmed: val.validationConfirmed,
      date: this.currentDate
    };

    if (this.isEditing && this.editingId) {
      this.dailyService.updateDetails(this.editingId, payload).subscribe({
        next: () => {
          this.showToast('Atendimento atualizado com sucesso!', 'success');
          this.closeModal();
        },
        error: () => this.showToast('Erro ao atualizar atendimento', 'warning')
      });
    } else {
      this.dailyService.addCheckin(payload).subscribe({
        next: (created) => {
          this.showToast(`Pet ${created.petName} entrou na fila! Posição: #${created.queueOrder}`, 'success');
          this.closeModal();
        },
        error: (err) => {
          const msg = err?.error?.error || 'Erro ao realizar check-in';
          this.showToast(msg, 'warning');
        }
      });
    }
  }

  changeStatus(item: DailyService, newStatus: DailyServiceStatus): void {
    this.dailyService.updateStatus(item.id, newStatus).subscribe({
      next: (updated) => {
        if (newStatus === 'em_atendimento') {
          this.showToast(`🚿 ${updated.petName} entrou em banho/tosa!`, 'info');
        } else if (newStatus === 'pronto') {
          this.showToast(`✨ ${updated.petName} está prontinho para retirada!`, 'success');
        } else if (newStatus === 'entregue') {
          this.showToast(`🐾 ${updated.petName} entregue ao tutor com sucesso!`, 'success');
        } else {
          this.showToast(`Status de ${updated.petName} alterado para "${newStatus}".`, 'info');
        }
      },
      error: () => this.showToast('Erro ao alterar status', 'warning')
    });
  }

  confirmValidation(item: DailyService): void {
    this.dailyService.updateDetails(item.id, { validationConfirmed: true }).subscribe({
      next: () => this.showToast(`Tosa de ${item.petName} validada com o tutor!`, 'success'),
      error: () => this.showToast('Erro ao confirmar validação', 'warning')
    });
  }

  openWhatsAppNotification(item: DailyService): void {
    const rawPhone = (item.phone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 11 ? '55' + rawPhone : (rawPhone.length === 13 ? rawPhone : '');
    const text = encodeURIComponent(
      `Olá ${item.customerName}! 🐶 O seu pet ${item.petName} já está cheiroso e prontinho para ser retirado aqui na Animal World! Aguardamos vocês. ✨`
    );
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } else {
      this.showToast('Telefone do tutor inválido para WhatsApp', 'warning');
    }
  }

  deleteItem(item: DailyService): void {
    if (confirm(`Deseja remover ${item.petName} da fila do dia?`)) {
      this.dailyService.delete(item.id).subscribe({
        next: () => this.showToast('Atendimento removido da fila', 'info'),
        error: () => this.showToast('Erro ao remover da fila', 'warning')
      });
    }
  }

  hasHealthAlerts(checklist: HealthChecklist): boolean {
    if (!checklist) return false;
    return !!(
      checklist.skin_lesion ||
      checklist.parasites ||
      checklist.paw_lesion ||
      checklist.vomiting_diarrhea ||
      checklist.general_malaise
    );
  }

  getHealthSummary(checklist: HealthChecklist): string {
    if (!checklist) return '';
    const alerts: string[] = [];
    if (checklist.skin_lesion) alerts.push('Lesão de pele');
    if (checklist.parasites) alerts.push('Parasitas');
    if (checklist.paw_lesion) alerts.push('Lesão em pata');
    if (checklist.vomiting_diarrhea) alerts.push('Vômito/Diarreia');
    if (checklist.general_malaise) alerts.push('Mal-estar');
    return alerts.join(', ');
  }

  formatTime(isoString?: string | null): string {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  formatPrice(price: number): string {
    return (Number(price) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private showToast(message: string, type: 'success' | 'warning' | 'info' = 'info'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 4500);
  }
}
