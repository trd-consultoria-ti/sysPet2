import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TaxiService } from '../../../shared/services/taxi.service';
import { WhatsappService } from '../../../shared/services/whatsapp.service';
import { TaxiRegion, TaxiTrip, TaxiTripStatus, TAXI_STATUS_LABELS } from '../../../shared/models/taxi.model';

@Component({
  selector: 'app-admin-taxi',
  templateUrl: './admin-taxi.component.html',
  styleUrls: ['./admin-taxi.component.scss']
})
export class AdminTaxiComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'corridas' | 'regioes' | 'cotador' = 'corridas';
  regions: TaxiRegion[] = [];
  trips: TaxiTrip[] = [];
  selectedStatusFilter: string = 'todas';

  // Modal Região (HU-12)
  showRegionModal = false;
  isEditingRegion = false;
  regionForm!: FormGroup;
  editingRegionId: string | null = null;

  // Testador de Endereço / Cotador Inteligente (HU-12)
  testAddressQuery = '';
  matchedRegion: TaxiRegion | null = null;
  matchSearched = false;

  // Modal WhatsApp Aviso Motorista (HU-15)
  showWaModal = false;
  waTargetTrip: TaxiTrip | null = null;
  waMessageText = '';

  // Toast feedback
  toastMessage = '';
  toastType: 'success' | 'danger' = 'success';

  readonly statusLabels = TAXI_STATUS_LABELS;

  constructor(
    private taxiService: TaxiService,
    private waService: WhatsappService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initRegionForm();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initRegionForm(): void {
    this.regionForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      aliases: [''],
      price: [15, [Validators.required, Validators.min(0)]],
      notes: [''],
      active: [true]
    });
  }

  loadData(): void {
    this.taxiService.getRegions().pipe(takeUntil(this.destroy$)).subscribe(reg => {
      this.regions = reg;
    });

    this.taxiService.getTrips().pipe(takeUntil(this.destroy$)).subscribe(trips => {
      this.trips = trips;
    });
  }

  // --- FILTRO DE CORRIDAS (HU-13) ---
  get filteredTrips(): TaxiTrip[] {
    if (this.selectedStatusFilter === 'todas') return this.trips;
    return this.trips.filter(t => t.status === this.selectedStatusFilter);
  }

  get stats() {
    return {
      total: this.trips.length,
      seeking: this.trips.filter(t => t.status === 'a_caminho_buscar').length,
      atStore: this.trips.filter(t => t.status === 'pet_na_loja').length,
      returning: this.trips.filter(t => t.status === 'a_caminho_devolver').length,
      done: this.trips.filter(t => t.status === 'concluida').length
    };
  }

  // --- TRANSIÇÃO DE STATUS DA CORRIDA (HU-13 & HU-15) ---
  updateTripStatus(trip: TaxiTrip, newStatus: TaxiTripStatus): void {
    this.taxiService.updateTripStatus(trip.id, newStatus).subscribe(() => {
      trip.status = newStatus;
      this.showToast(`Status da corrida atualizado para: ${this.statusLabels[newStatus].label}`, 'success');

      // Se for a caminho de buscar ou a caminho de devolver, abre modal de WhatsApp (HU-15)
      if (newStatus === 'a_caminho_buscar' || newStatus === 'a_caminho_devolver') {
        this.openWaNoticeModal(trip, newStatus);
      }
    });
  }

  // --- AVISO MOTORISTA A CAMINHO NO WHATSAPP (HU-15) ---
  openWaNoticeModal(trip: TaxiTrip, status: TaxiTripStatus): void {
    this.waTargetTrip = trip;
    if (status === 'a_caminho_buscar') {
      this.waMessageText = this.waService.buildDriverSeekingMessage(
        trip.customerName,
        trip.petName,
        trip.driverName,
        trip.originAddress
      );
    } else {
      this.waMessageText = this.waService.buildDriverReturningMessage(
        trip.customerName,
        trip.petName,
        trip.driverName
      );
    }
    this.showWaModal = true;
  }

  closeWaModal(): void {
    this.showWaModal = false;
    this.waTargetTrip = null;
    this.waMessageText = '';
  }

  sendWaMessage(): void {
    if (!this.waTargetTrip) return;
    this.waService.openWhatsAppDirect(this.waTargetTrip.customerPhone || '', this.waMessageText);
    this.showToast('Mensagem enviada via WhatsApp!', 'success');
    this.closeWaModal();
  }

  // --- CRUD REGIÕES (HU-12) ---
  openNewRegionModal(): void {
    this.isEditingRegion = false;
    this.editingRegionId = null;
    this.regionForm.reset({
      name: '',
      aliases: '',
      price: 15,
      notes: '',
      active: true
    });
    this.showRegionModal = true;
  }

  openEditRegionModal(reg: TaxiRegion): void {
    this.isEditingRegion = true;
    this.editingRegionId = reg.id;
    this.regionForm.patchValue({
      name: reg.name,
      aliases: (reg.aliases || []).join(', '),
      price: reg.price,
      notes: reg.notes || '',
      active: reg.active !== false
    });
    this.showRegionModal = true;
  }

  closeRegionModal(): void {
    this.showRegionModal = false;
    this.isEditingRegion = false;
    this.editingRegionId = null;
  }

  saveRegion(): void {
    if (this.regionForm.invalid) return;

    const val = this.regionForm.value;
    const aliasesArr = (val.aliases || '')
      .split(',')
      .map((a: string) => a.trim().toLowerCase())
      .filter((a: string) => a.length > 0);

    if (this.isEditingRegion && this.editingRegionId) {
      this.taxiService.updateRegion(this.editingRegionId, {
        name: val.name,
        aliases: aliasesArr,
        price: Number(val.price),
        notes: val.notes,
        active: val.active
      }).subscribe(() => {
        this.showToast('Região de táxi atualizada com sucesso!', 'success');
        this.closeRegionModal();
        this.loadData();
      });
    } else {
      this.taxiService.addRegion({
        name: val.name,
        aliases: aliasesArr,
        price: Number(val.price),
        notes: val.notes,
        active: val.active
      }).subscribe(() => {
        this.showToast('Nova região cadastrada com sucesso!', 'success');
        this.closeRegionModal();
        this.loadData();
      });
    }
  }

  toggleRegionActive(reg: TaxiRegion): void {
    const newStatus = !reg.active;
    this.taxiService.updateRegion(reg.id, { active: newStatus }).subscribe(() => {
      reg.active = newStatus;
      this.showToast(`Região ${reg.name} ${newStatus ? 'ativada' : 'desativada'}.`, 'success');
    });
  }

  deleteRegion(reg: TaxiRegion): void {
    if (confirm(`Deseja realmente remover a região "${reg.name}"?`)) {
      this.taxiService.deleteRegion(reg.id).subscribe(() => {
        this.showToast(`Região ${reg.name} removida.`, 'success');
        this.loadData();
      });
    }
  }

  // --- COTADOR / TESTADOR DE ENDEREÇO (HU-12) ---
  testAddress(): void {
    this.matchSearched = true;
    this.matchedRegion = this.taxiService.findRegionByQuery(this.testAddressQuery);
  }

  clearTest(): void {
    this.testAddressQuery = '';
    this.matchedRegion = null;
    this.matchSearched = false;
  }

  formatPrice(p: number): string {
    return (p || 0).toFixed(2).replace('.', ',');
  }

  private showToast(msg: string, type: 'success' | 'danger'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }
}
