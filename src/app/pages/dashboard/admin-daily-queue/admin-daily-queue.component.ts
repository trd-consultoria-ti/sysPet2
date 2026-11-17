import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DailyServicesService } from '../../../shared/services/daily-services.service';
import { DailyService, DailyQueueStats, DailyServiceStatus, HealthChecklist } from '../../../shared/models/daily-service.model';
import { ServiceCatalogService } from '../../../shared/services/service-catalog.service';
import { Service } from '../../../shared/models/service.model';
import { CashService } from '../../../shared/services/cash.service';
import { CartService } from '../../../shared/services/cart.service';
import { PricingService, PricingQuote, ExtraServiceOption, BusinessDayConfig } from '../../../shared/services/pricing.service';
import { getPetSizeTier, getPetSizeLabel } from '../../../shared/models/pet.model';
import { TaxiService } from '../../../shared/services/taxi.service';
import { WhatsappService } from '../../../shared/services/whatsapp.service';
import { TaxiRegion, TaxiTripStatus, TAXI_STATUS_LABELS } from '../../../shared/models/taxi.model';
import { GroomerService } from '../../../shared/services/groomer.service';
import { Groomer } from '../../../shared/models/groomer.model';

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
    isFull: false,
    isClosed: false
  };

  viewMode: 'kanban' | 'list' = 'kanban';
  currentDate: string = new Date().toISOString().split('T')[0];
  activeFilter: 'todos' | DailyServiceStatus = 'todos';
  availableServices: Service[] = [];
  availableExtras: ExtraServiceOption[] = [];

  readonly columns: KanbanColumn[] = [
    { key: 'aguardando', label: '1. Gaiola / Espera', icon: 'fas fa-clock', actionLabel: 'Iniciar Banho', badgeClass: 'waiting' },
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

  // Cotação e Matriz de Preço (HU-08 / HU-09)
  currentQuote: PricingQuote | null = null;
  selectedExtras: string[] = [];

  // Validação Humana de Tosa Bloqueante (HU-06)
  showTosaValidationModal: boolean = false;
  tosaTargetItem: DailyService | null = null;
  tosaPendingNextStatus: DailyServiceStatus | null = null;
  tosaValidationForm!: FormGroup;

  // Expediente & Capacidade (HU-04 e HU-26)
  isClosed: boolean = false;
  showCapacityModal: boolean = false;
  businessHoursList: BusinessDayConfig[] = [];

  toastMessage: string | null = null;
  toastType: 'success' | 'warning' | 'info' = 'info';

  // Modal de Encaminhamento ao Caixa (Fim da Esteira)
  showCashModal: boolean = false;
  cashTargetItem: DailyService | null = null;
  selectedPaymentMethod: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' = 'pix';
  isProcessingPayment: boolean = false;

  // Táxi Dog Integrado (HU-12, HU-13, HU-15)
  taxiRegions: TaxiRegion[] = [];
  regionSearchText = '';
  regionNotFoundAlert = false;
  showQuickRegionModal = false;
  quickRegionForm!: FormGroup;
  showTaxiWaModal = false;
  taxiWaTargetItem: DailyService | null = null;
  taxiWaMessageText = '';

  // Tosadores e Rateio de Comissão (HU-18 / HU-19)
  groomers: Groomer[] = [];

  private sub: Subscription = new Subscription();

  constructor(
    private dailyService: DailyServicesService,
    private catalogService: ServiceCatalogService,
    public pricingService: PricingService,
    public taxiService: TaxiService,
    public waService: WhatsappService,
    public groomerService: GroomerService,
    private fb: FormBuilder,
    private router: Router,
    private cashService: CashService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.availableExtras = this.pricingService.availableExtras;
    this.businessHoursList = this.pricingService.getBusinessHours();
    this.checkIfDateIsClosed();

    this.initForm();
    this.initTosaValidationForm();
    this.initQuickRegionForm();
    this.loadCatalog();
    this.loadTaxiRegions();
    this.loadGroomers();

    this.sub.add(
      this.dailyService.queue$.subscribe(res => {
        this.queueItems = res.items || [];
        this.stats = res.stats;
        this.checkIfDateIsClosed();
        this.applyFilter();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private checkIfDateIsClosed(): void {
    this.isClosed = this.pricingService.isDayClosed(this.currentDate);
    if (this.stats) {
      this.stats.isClosed = this.isClosed;
      if (this.isClosed) {
        this.stats.isFull = true;
        this.stats.remainingSpots = 0;
      }
    }
  }

  private initForm(): void {
    this.checkinForm = this.fb.group({
      customerName: ['', Validators.required],
      phone: ['', Validators.required],
      petName: ['', Validators.required],
      petBreed: [''],
      petWeightKg: [null, [Validators.min(0.1)]],
      serviceName: ['Banho Completo', Validators.required],
      estimatedPrice: [50.00, [Validators.required, Validators.min(0)]],
      cageNumber: [''],
      groomerId: [null],
      groomerName: [''],
      isGroomerPair: [false],
      secondGroomerId: [null],
      secondGroomerName: [''],
      notes: [''],
      tosaNotes: [''],
      health_skin: [false],
      health_parasites: [false],
      health_paw: [false],
      health_vomiting: [false],
      health_malaise: [false],
      health_obs: [''],
      requiresValidation: [false],
      validationConfirmed: [true],
      hasTaxi: [false],
      taxiRegionId: [''],
      taxiRegionName: [''],
      taxiOriginAddress: [''],
      taxiTripType: ['ida_e_volta'],
      taxiDriverName: ['Lucas (O Rapaz)'],
      taxiPrice: [0]
    });

    // Recálculo dinâmico da matriz de preços ao alterar serviço, raça ou peso
    this.checkinForm.get('serviceName')?.valueChanges.subscribe(() => this.recalculateQuote());
    this.checkinForm.get('petBreed')?.valueChanges.subscribe(() => this.recalculateQuote());
    this.checkinForm.get('petWeightKg')?.valueChanges.subscribe(() => this.recalculateQuote());
    this.checkinForm.get('hasTaxi')?.valueChanges.subscribe(() => this.recalculateQuote());

    // Sincronização do nome do tosador ao selecionar pelo ID
    this.checkinForm.get('groomerId')?.valueChanges.subscribe(id => {
      if (id !== null && id !== undefined) {
        const g = this.groomers.find(x => x.id === +id);
        this.checkinForm.patchValue({ groomerName: g ? g.name : '' }, { emitEvent: false });
      }
    });

    this.checkinForm.get('secondGroomerId')?.valueChanges.subscribe(id => {
      if (id !== null && id !== undefined) {
        const g = this.groomers.find(x => x.id === +id);
        this.checkinForm.patchValue({ secondGroomerName: g ? g.name : '' }, { emitEvent: false });
      }
    });
  }

  private initTosaValidationForm(): void {
    this.tosaValidationForm = this.fb.group({
      confirmedWithTutor: [true, Validators.requiredTrue],
      validatedBy: ['', Validators.required],
      tosaNotes: ['', Validators.required]
    });
  }

  private loadGroomers(): void {
    this.sub.add(
      this.groomerService.getGroomers().subscribe(list => {
        this.groomers = list.filter(g => g.active);
      })
    );
  }

  private loadCatalog(): void {
    this.catalogService.getServices().subscribe(services => {
      this.availableServices = services;
    });
  }

  // -------------------------------------------------------------
  // Precificação Automática & Cotação (HU-08 / HU-09 / HU-07 / HU-12 / HU-13)
  // -------------------------------------------------------------
  recalculateQuote(): void {
    const sName = this.checkinForm.get('serviceName')?.value || 'Banho Completo';
    const breed = this.checkinForm.get('petBreed')?.value || '';
    const weight = this.checkinForm.get('petWeightKg')?.value || null;
    const hasTaxi = !!this.checkinForm.get('hasTaxi')?.value;
    const taxiPrice = hasTaxi ? Number(this.checkinForm.get('taxiPrice')?.value || 0) : 0;
    const taxiRegionName = hasTaxi ? (this.checkinForm.get('taxiRegionName')?.value || '') : '';

    const isTosa = String(sName).toLowerCase().includes('tosa');
    if (isTosa) {
      this.checkinForm.patchValue({
        requiresValidation: true,
        validationConfirmed: false
      }, { emitEvent: false });
    }

    this.currentQuote = this.pricingService.calculateQuote(
      sName,
      weight,
      breed,
      this.selectedExtras,
      taxiPrice,
      taxiRegionName
    );

    this.checkinForm.patchValue({
      estimatedPrice: this.currentQuote.totalPrice
    }, { emitEvent: false });
  }

  // --- TÁXI DOG HELPERS (HU-12, HU-13, HU-15) ---
  loadTaxiRegions(): void {
    this.taxiService.getRegions().subscribe(regs => {
      this.taxiRegions = regs;
    });
  }

  initQuickRegionForm(): void {
    this.quickRegionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      price: [20, [Validators.required, Validators.min(0)]],
      aliases: [''],
      notes: ['']
    });
  }

  onTaxiToggled(): void {
    const hasTaxi = this.checkinForm.get('hasTaxi')?.value;
    if (hasTaxi && !this.checkinForm.get('taxiRegionId')?.value && this.taxiRegions.length > 0) {
      const first = this.taxiRegions[0];
      this.checkinForm.patchValue({
        taxiRegionId: first.id,
        taxiRegionName: first.name,
        taxiPrice: first.price
      });
    } else if (!hasTaxi) {
      this.checkinForm.patchValue({
        taxiPrice: 0,
        taxiRegionId: '',
        taxiRegionName: ''
      });
    }
    this.recalculateQuote();
  }

  onTaxiRegionChanged(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const regId = select.value;
    const found = this.taxiRegions.find(r => r.id === regId);
    if (found) {
      this.checkinForm.patchValue({
        taxiRegionName: found.name,
        taxiPrice: found.price
      });
      this.regionNotFoundAlert = false;
    } else {
      this.checkinForm.patchValue({
        taxiRegionName: '',
        taxiPrice: 0
      });
    }
    this.recalculateQuote();
  }

  searchRegionByText(): void {
    if (!this.regionSearchText || !this.regionSearchText.trim()) {
      this.regionNotFoundAlert = false;
      return;
    }
    const match = this.taxiService.findRegionByQuery(this.regionSearchText);
    if (match) {
      this.checkinForm.patchValue({
        taxiRegionId: match.id,
        taxiRegionName: match.name,
        taxiPrice: match.price
      });
      this.regionNotFoundAlert = false;
      this.recalculateQuote();
    } else {
      this.regionNotFoundAlert = true;
    }
  }

  openQuickRegionModal(): void {
    this.quickRegionForm.reset({
      name: this.regionSearchText || '',
      price: 20,
      aliases: this.regionSearchText || '',
      notes: ''
    });
    this.showQuickRegionModal = true;
  }

  closeQuickRegionModal(): void {
    this.showQuickRegionModal = false;
  }

  saveQuickRegion(): void {
    if (this.quickRegionForm.invalid) return;
    const val = this.quickRegionForm.value;
    const aliases = (val.aliases || '').split(',').map((a: string) => a.trim()).filter((a: string) => a.length > 0);
    this.taxiService.addRegion({
      name: val.name,
      price: Number(val.price),
      aliases,
      notes: val.notes,
      active: true
    }).subscribe(created => {
      this.taxiRegions.push(created);
      this.checkinForm.patchValue({
        taxiRegionId: created.id,
        taxiRegionName: created.name,
        taxiPrice: created.price
      });
      this.regionNotFoundAlert = false;
      this.closeQuickRegionModal();
      this.recalculateQuote();
      this.showToast(`Região ${created.name} cadastrada e aplicada!`, 'success');
    });
  }

  getTaxiStatusLabel(status?: string): string {
    if (!status) return 'Aguardando';
    const s = status as TaxiTripStatus;
    return TAXI_STATUS_LABELS[s]?.label || status;
  }

  advanceTaxiStatus(item: DailyService, newStatus: TaxiTripStatus): void {
    item.taxiStatus = newStatus;
    if (item.taxiTripId) {
      this.taxiService.updateTripStatus(item.taxiTripId, newStatus).subscribe();
    }
    this.dailyService.updateDetails(item.id, { taxiStatus: newStatus }).subscribe(() => {
      this.showToast(`Status do Táxi para ${item.petName}: ${this.getTaxiStatusLabel(newStatus)}`, 'success');
      if (newStatus === 'a_caminho_buscar' || newStatus === 'a_caminho_devolver') {
        this.openTaxiWhatsAppModal(item);
      }
    });
  }

  openTaxiWhatsAppModal(item: DailyService): void {
    this.taxiWaTargetItem = item;
    if (item.taxiStatus === 'a_caminho_devolver') {
      this.taxiWaMessageText = this.waService.buildDriverReturningMessage(
        item.customerName,
        item.petName,
        item.taxiDriverName || 'Lucas (O Rapaz)'
      );
    } else {
      this.taxiWaMessageText = this.waService.buildDriverSeekingMessage(
        item.customerName,
        item.petName,
        item.taxiDriverName || 'Lucas (O Rapaz)',
        item.taxiOriginAddress || ''
      );
    }
    this.showTaxiWaModal = true;
  }

  closeTaxiWaModal(): void {
    this.showTaxiWaModal = false;
    this.taxiWaTargetItem = null;
    this.taxiWaMessageText = '';
  }

  sendTaxiWaMessage(): void {
    if (!this.taxiWaTargetItem) return;
    this.waService.openWhatsAppDirect(this.taxiWaTargetItem.phone || '', this.taxiWaMessageText);
    this.showToast('WhatsApp aberto para envio do aviso!', 'success');
    this.closeTaxiWaModal();
  }

  toggleExtra(extraId: string): void {
    const idx = this.selectedExtras.indexOf(extraId);
    if (idx >= 0) {
      this.selectedExtras.splice(idx, 1);
    } else {
      this.selectedExtras.push(extraId);
    }
    this.recalculateQuote();
  }

  isExtraSelected(extraId: string): boolean {
    return this.selectedExtras.includes(extraId);
  }

  getCalculatedSizeTier(): string {
    const w = this.checkinForm.get('petWeightKg')?.value;
    if (!w) return 'Informe o peso';
    return getPetSizeLabel(getPetSizeTier(w));
  }

  onServiceSelected(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.checkinForm.patchValue({ serviceName: select.value });
    this.recalculateQuote();
  }

  // -------------------------------------------------------------
  // Navegação de Datas & Filtros
  // -------------------------------------------------------------
  changeDate(delta: number): void {
    const d = new Date(this.currentDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    this.currentDate = d.toISOString().split('T')[0];
    this.checkIfDateIsClosed();
    this.dailyService.refresh(this.currentDate).subscribe();
  }

  setToday(): void {
    this.currentDate = new Date().toISOString().split('T')[0];
    this.checkIfDateIsClosed();
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

  // -------------------------------------------------------------
  // Avanço e Regresso de Estágios com Bloqueio HU-06
  // -------------------------------------------------------------
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
      // HU-06: Bloqueio estrito — Tosa NUNCA avança para pronto ou entregue sem confirmação humana!
      if (['pronto', 'entregue'].includes(next) && item.requiresValidation && !item.validationConfirmed) {
        this.showToast(`⛔ A tosa de ${item.petName} exige conferência humana com o tutor antes de concluir!`, 'warning');
        this.openTosaValidationModal(item, next);
        return;
      }

      this.changeStatus(item, next);
      if (next === 'entregue') {
        this.openCashForwardModal(item);
      }
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
      const item = this.draggedItem;

      // HU-06: Bloqueio no Drag & Drop
      if (['pronto', 'entregue'].includes(targetStatus) && item.requiresValidation && !item.validationConfirmed) {
        this.showToast(`⛔ Tosa de ${item.petName} não confirmada. Validação com o tutor é obrigatória!`, 'warning');
        this.openTosaValidationModal(item, targetStatus);
        this.draggedItem = null;
        return;
      }

      this.changeStatus(item, targetStatus);
      if (targetStatus === 'entregue') {
        this.openCashForwardModal(item);
      }
    }
    this.draggedItem = null;
  }

  // -------------------------------------------------------------
  // Modal de Validação de Tosa (HU-06)
  // -------------------------------------------------------------
  openTosaValidationModal(item: DailyService, pendingNextStatus?: DailyServiceStatus): void {
    this.tosaTargetItem = item;
    this.tosaPendingNextStatus = pendingNextStatus || null;
    this.tosaValidationForm.reset({
      confirmedWithTutor: true,
      validatedBy: item.groomerName || 'Recepção Animal World',
      tosaNotes: item.tosaNotes || item.notes || 'Tosa alinhada conforme padrão da raça e orientação do tutor'
    });
    this.showTosaValidationModal = true;
  }

  closeTosaValidationModal(): void {
    this.showTosaValidationModal = false;
    this.tosaTargetItem = null;
    this.tosaPendingNextStatus = null;
  }

  confirmTosaValidation(): void {
    if (this.tosaValidationForm.invalid || !this.tosaTargetItem) {
      this.tosaValidationForm.markAllAsTouched();
      return;
    }

    const item = this.tosaTargetItem;
    const formVal = this.tosaValidationForm.value;
    const now = new Date().toISOString();

    this.dailyService.updateDetails(item.id, {
      validationConfirmed: true,
      validatedBy: formVal.validatedBy,
      validatedAt: now,
      tosaNotes: formVal.tosaNotes
    }).subscribe({
      next: () => {
        item.validationConfirmed = true;
        item.validatedBy = formVal.validatedBy;
        item.validatedAt = now;
        item.tosaNotes = formVal.tosaNotes;

        this.showToast(`✂️ Tosa de ${item.petName} validada com sucesso por ${formVal.validatedBy}!`, 'success');
        const next = this.tosaPendingNextStatus;
        this.closeTosaValidationModal();

        if (next) {
          this.changeStatus(item, next);
          if (next === 'entregue') {
            this.openCashForwardModal(item);
          }
        }
      },
      error: () => this.showToast('Erro ao registrar validação de tosa.', 'warning')
    });
  }

  // -------------------------------------------------------------
  // Notificação WhatsApp com ETA (HU-03 & HU-14)
  // -------------------------------------------------------------
  sendEtaWhatsApp(item: DailyService): void {
    const rawPhone = (item.phone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 11 ? '55' + rawPhone : (rawPhone.length === 13 ? rawPhone : '');
    const etaStr = item.estimatedReadyAt || this.formatEstimatedOut(item);
    const text = encodeURIComponent(
      `Olá ${item.customerName}! 🐶 Passando para avisar que o(a) ${item.petName} já está aos nossos cuidados na Animal World para ${item.serviceName}.\n\n` +
      `⏱️ Previsão estimada de saída: ~${etaStr}.\n\n` +
      `Assim que estiver prontinho e cheiroso nós te avisamos aqui no WhatsApp! ✨🐾`
    );

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      this.showToast(`Previsão de saída (~${etaStr}) enviada via WhatsApp para ${item.customerName}!`, 'success');
    } else {
      this.showToast('Telefone do tutor inválido para WhatsApp', 'warning');
    }
  }

  formatEstimatedOut(item: DailyService): string {
    if (item.estimatedReadyAt) return item.estimatedReadyAt;
    const baseTime = item.checkinAt ? new Date(item.checkinAt) : new Date();
    const eta = this.pricingService.estimateReadyTime(baseTime, 60, item.queueOrder || 1);
    return eta.formattedTime;
  }

  // -------------------------------------------------------------
  // Expediente e Capacidade Configurável (HU-04 e HU-26)
  // -------------------------------------------------------------
  openCapacityModal(): void {
    this.businessHoursList = this.pricingService.getBusinessHours();
    this.showCapacityModal = true;
  }

  closeCapacityModal(): void {
    this.showCapacityModal = false;
  }

  saveCapacityConfig(): void {
    this.pricingService.saveBusinessHours(this.businessHoursList);
    this.checkIfDateIsClosed();
    this.dailyService.refresh(this.currentDate).subscribe();
    this.showToast('Configurações de expediente e capacidade salvas com sucesso!', 'success');
    this.closeCapacityModal();
  }

  // -------------------------------------------------------------
  // Encaminhamento ao Caixa (Fim da Esteira)
  // -------------------------------------------------------------
  openCashForwardModal(item: DailyService): void {
    this.cashTargetItem = item;
    this.selectedPaymentMethod = 'pix';
    this.showCashModal = true;
  }

  closeCashModal(): void {
    this.showCashModal = false;
    this.cashTargetItem = null;
  }

  confirmQuickPayment(): void {
    if (!this.cashTargetItem) return;
    this.isProcessingPayment = true;
    const item = this.cashTargetItem;
    const amount = Number(item.finalPrice || item.estimatedPrice || 0);
    const description = `Atendimento Banho & Tosa — Pet ${item.petName} (${item.serviceName}) • Tutor: ${item.customerName}`;

    this.cashService.register({
      type: 'entrada',
      description,
      amount,
      paymentMethod: this.selectedPaymentMethod
    }).subscribe({
      next: () => {
        item.paid = true;
        item.paymentMethod = this.selectedPaymentMethod;
        item.paidAt = new Date().toISOString();
        this.dailyService.updateDetails(item.id, {
          paid: true,
          paymentMethod: this.selectedPaymentMethod,
          paidAt: item.paidAt
        }).subscribe();

        this.isProcessingPayment = false;
        this.closeCashModal();
        this.showToast(`💰 Pagamento de R$ ${this.formatPrice(amount)} (${this.selectedPaymentMethod.toUpperCase()}) registrado no Caixa com sucesso!`, 'success');
      },
      error: () => {
        this.isProcessingPayment = false;
        this.showToast('Erro ao registrar pagamento no Caixa.', 'warning');
      }
    });
  }

  redirectToCashRegister(item: DailyService): void {
    const amount = item.finalPrice || item.estimatedPrice || 0;
    const description = `Atendimento Banho & Tosa — Pet ${item.petName} (${item.serviceName}) • Tutor: ${item.customerName}`;
    this.closeCashModal();
    this.router.navigate(['/dashboard/cash'], {
      queryParams: {
        source: 'daily-queue',
        petName: item.petName,
        customerName: item.customerName,
        serviceName: item.serviceName,
        amount: amount,
        description: description,
        paymentMethod: this.selectedPaymentMethod
      }
    });
  }

  addToCart(item: DailyService): void {
    const amount = Number(item.finalPrice || item.estimatedPrice || 0);
    this.cartService.addCustomItem({
      id: 9000 + item.id,
      name: `Serviço: ${item.serviceName} — Pet ${item.petName}`,
      price: amount,
      image: 'assets/images/logo.png',
      quantity: 1
    });
    this.closeCashModal();
    this.showToast(`🛒 Atendimento de ${item.petName} adicionado ao Carrinho com sucesso!`, 'success');
    this.router.navigate(['/cart']);
  }

  // -------------------------------------------------------------
  // Modal de Check-in
  // -------------------------------------------------------------
  openCheckinModal(): void {
    if (this.isClosed) {
      this.showToast('O pet shop está fechado aos domingos. Check-in não permitido.', 'warning');
      return;
    }
    if (this.stats.isFull) {
      this.showToast('Vagas do dia esgotadas! Não é possível realizar novos check-ins hoje.', 'warning');
      return;
    }

    this.isEditing = false;
    this.editingId = null;
    this.selectedExtras = [];

    this.checkinForm.reset({
      customerName: '',
      phone: '',
      petName: '',
      petBreed: '',
      petWeightKg: null,
      serviceName: 'Banho Completo',
      estimatedPrice: 50.00,
      cageNumber: '',
      groomerId: null,
      groomerName: '',
      isGroomerPair: false,
      secondGroomerId: null,
      secondGroomerName: '',
      notes: '',
      tosaNotes: '',
      health_skin: false,
      health_parasites: false,
      health_paw: false,
      health_vomiting: false,
      health_malaise: false,
      health_obs: '',
      requiresValidation: false,
      validationConfirmed: true
    });

    this.recalculateQuote();
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

    const quote = this.currentQuote || this.pricingService.calculateQuote(val.serviceName, val.petWeightKg, val.petBreed, this.selectedExtras);
    const eta = this.pricingService.estimateReadyTime(new Date(), quote.totalDurationMin, this.stats.waiting);

    const payload: Partial<DailyService> = {
      customerName: val.customerName,
      phone: val.phone,
      petName: val.petName,
      petBreed: val.petBreed,
      petWeightKg: val.petWeightKg ? Number(val.petWeightKg) : null,
      petSizeTier: quote.sizeTier,
      serviceName: val.serviceName,
      selectedExtras: this.selectedExtras,
      estimatedPrice: val.estimatedPrice,
      cageNumber: val.cageNumber,
      groomerId: val.groomerId ? Number(val.groomerId) : undefined,
      groomerName: val.groomerName,
      isGroomerPair: !!val.isGroomerPair,
      secondGroomerId: val.isGroomerPair && val.secondGroomerId ? Number(val.secondGroomerId) : undefined,
      secondGroomerName: val.isGroomerPair ? val.secondGroomerName : undefined,
      notes: val.notes,
      tosaNotes: val.tosaNotes,
      healthChecklist,
      requiresValidation: val.requiresValidation,
      validationConfirmed: val.validationConfirmed,
      estimatedReadyAt: eta.formattedTime,
      date: this.currentDate,
      hasTaxi: !!val.hasTaxi,
      taxiPrice: val.hasTaxi ? Number(val.taxiPrice || 0) : 0,
      taxiRegionId: val.hasTaxi ? val.taxiRegionId : undefined,
      taxiRegionName: val.hasTaxi ? val.taxiRegionName : undefined,
      taxiDriverName: val.hasTaxi ? val.taxiDriverName : undefined,
      taxiOriginAddress: val.hasTaxi ? val.taxiOriginAddress : undefined,
      taxiStatus: val.hasTaxi ? 'a_caminho_buscar' : undefined
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
          this.showToast(`Pet ${created.petName} entrou na fila! Posição: #${created.queueOrder} (Saída estimada: ~${eta.formattedTime})`, 'success');

          // Vincula Corrida de Táxi Dog (HU-13)
          if (val.hasTaxi) {
            this.taxiService.createTrip({
              checkinId: String(created.id),
              petName: created.petName,
              customerName: created.customerName,
              customerPhone: created.phone,
              originAddress: val.taxiOriginAddress,
              regionId: val.taxiRegionId,
              regionName: val.taxiRegionName,
              price: Number(val.taxiPrice || 0),
              driverName: val.taxiDriverName || 'Lucas (O Rapaz)',
              status: 'a_caminho_buscar',
              tripType: val.taxiTripType || 'ida_e_volta'
            }).subscribe(trip => {
              this.dailyService.updateDetails(created.id, { taxiTripId: trip.id }).subscribe();
            });
          }

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
      error: (err) => {
        const msg = err?.error?.error || 'Erro ao alterar status';
        this.showToast(msg, 'warning');
      }
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
