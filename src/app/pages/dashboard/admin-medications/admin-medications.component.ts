import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MedicationService } from '../../../shared/services/medication.service';
import { Medication } from '../../../shared/models/medication.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-medications',
  templateUrl: './admin-medications.component.html',
  styleUrls: ['./admin-medications.component.scss']
})
export class AdminMedicationsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  medications: Medication[] = [];
  filteredMedications: Medication[] = [];

  showForm = false;
  editingId: number | null = null;
  form: FormGroup;
  error = '';
  success = '';

  searchTerm = '';
  selectedCategory = 'todas';

  readonly categories = [
    'Antipulgas & Carrapatos',
    'Antibiótico',
    'Anti-inflamatório & Analgésico',
    'Anti-alérgico / Dermatológico',
    'Vermífugo',
    'Otológico / Oftálmico',
    'Protetor Gástrico',
    'Dermatológico / Higiene Terapêutica',
    'Suplemento & Vitamina',
    'Outros'
  ];

  readonly presentations = [
    'Comprimido',
    'Mastigável',
    'Gotas',
    'Injetável',
    'Pomada / Tópico',
    'Spray',
    'Xarope',
    'Shampoo'
  ];

  constructor(
    private fb: FormBuilder,
    private medicationService: MedicationService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      activePrinciple: ['', Validators.maxLength(120)],
      category: ['Outros', Validators.required],
      presentation: ['Comprimido', Validators.required],
      concentration: ['', Validators.maxLength(60)],
      price: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      unit: ['cx', Validators.required],
      defaultDosage: [''],
      requiresPrescription: [false],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.medicationService.list().pipe(takeUntil(this.destroy$)).subscribe({
      next: (meds) => {
        this.medications = meds;
        this.applyFilter();
      },
      error: () => this.error = 'Erro ao carregar catálogo de medicamentos.'
    });
  }

  applyFilter(): void {
    let list = [...this.medications];
    if (this.selectedCategory && this.selectedCategory !== 'todas') {
      list = list.filter(m => m.category === this.selectedCategory);
    }
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(m =>
        (m.name && m.name.toLowerCase().includes(term)) ||
        (m.activePrinciple && m.activePrinciple.toLowerCase().includes(term))
      );
    }
    this.filteredMedications = list;
  }

  get totalCount(): number {
    return this.medications.length;
  }

  get lowStockCount(): number {
    return this.medications.filter(m => m.stock < 10).length;
  }

  get prescriptionCount(): number {
    return this.medications.filter(m => m.requiresPrescription).length;
  }

  openCreate(): void {
    this.editingId = null;
    this.error = '';
    this.success = '';
    this.form.reset({
      name: '',
      activePrinciple: '',
      category: 'Outros',
      presentation: 'Comprimido',
      concentration: '',
      price: 0,
      stock: 0,
      unit: 'cx',
      defaultDosage: '',
      requiresPrescription: false,
      active: true
    });
    this.showForm = true;
  }

  openEdit(med: Medication): void {
    this.editingId = med.id;
    this.error = '';
    this.success = '';
    this.form.patchValue({
      name: med.name,
      activePrinciple: med.activePrinciple,
      category: med.category,
      presentation: med.presentation,
      concentration: med.concentration,
      price: med.price,
      stock: med.stock,
      unit: med.unit || 'cx',
      defaultDosage: med.defaultDosage || '',
      requiresPrescription: !!med.requiresPrescription,
      active: med.active !== false
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editingId = null;
  }

  save(): void {
    if (this.form.invalid) return;
    this.error = '';
    const payload = this.form.value;

    if (this.editingId) {
      this.medicationService.update(this.editingId, payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showForm = false;
          this.editingId = null;
          this.success = 'Medicamento atualizado com sucesso!';
          this.load();
          setTimeout(() => this.success = '', 3000);
        },
        error: (err) => this.error = err?.error?.error || 'Erro ao atualizar medicamento'
      });
    } else {
      this.medicationService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showForm = false;
          this.success = 'Medicamento cadastrado com sucesso!';
          this.load();
          setTimeout(() => this.success = '', 3000);
        },
        error: (err) => this.error = err?.error?.error || 'Erro ao cadastrar medicamento'
      });
    }
  }

  remove(med: Medication): void {
    if (confirm(`Deseja realmente excluir o medicamento "${med.name}"?`)) {
      this.medicationService.delete(med.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.success = `"${med.name}" excluído.`;
          this.load();
          setTimeout(() => this.success = '', 3000);
        },
        error: () => this.error = 'Não foi possível excluir o medicamento.'
      });
    }
  }

  formatPrice(val: number): string {
    return (val || 0).toFixed(2).replace('.', ',');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
