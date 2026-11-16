import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Vet } from '../../../shared/models/vet.model';
import { VetService } from '../../../shared/services/vet.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-admin-vets',
  templateUrl: './admin-vets.component.html',
  styleUrls: ['./admin-vets.component.scss']
})
export class AdminVetsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vets: Vet[] = [];
  isAdmin = false;
  error = '';
  success = '';
  saving = false;

  showForm = false;
  editingId: number | null = null;
  form = { name: '', crmv: '', specialty: '', phone: '', active: true };

  // Filtros e busca em tempo real
  searchTerm: string = '';
  statusFilter: 'todos' | 'ativo' | 'inativo' = 'todos';

  constructor(private vetService: VetService, private authService: AuthService) {}

  get totalVets(): number {
    return this.vets.length;
  }

  get activeVets(): number {
    return this.vets.filter(v => v.active).length;
  }

  get specialtiesCount(): number {
    const set = new Set(this.vets.map(v => v.specialty?.trim()).filter(Boolean));
    return set.size;
  }

  get filteredVets(): Vet[] {
    const term = (this.searchTerm || '').toLowerCase().trim();
    return this.vets.filter(v => {
      const matchStatus = 
        this.statusFilter === 'todos' ||
        (this.statusFilter === 'ativo' && v.active) ||
        (this.statusFilter === 'inativo' && !v.active);

      if (!matchStatus) {
        return false;
      }

      if (!term) {
        return true;
      }

      const name = (v.name || '').toLowerCase();
      const crmv = (v.crmv || '').toLowerCase();
      const specialty = (v.specialty || '').toLowerCase();
      const phone = (v.phone || '').toLowerCase();

      return name.includes(term) || crmv.includes(term) || specialty.includes(term) || phone.includes(term);
    });
  }

  getInitials(name: string): string {
    if (!name) return 'V';
    const parts = name.replace(/^(Dr\.|Dra\.|Médico|Médica)\s+/i, '').trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatPhone(phone?: string): string {
    if (!phone) return '—';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    } else if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return phone;
  }

  ngOnInit(): void {
    this.isAdmin = this.authService.getCurrentUser()?.role === 'admin';
    this.vetService.refresh();
    this.vetService.getVets().pipe(takeUntil(this.destroy$)).subscribe(vets => {
      this.vets = vets;
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name: '', crmv: '', specialty: '', phone: '', active: true };
    this.showForm = true;
  }

  openEdit(vet: Vet): void {
    this.editingId = vet.id;
    this.form = {
      name: vet.name,
      crmv: vet.crmv || '',
      specialty: vet.specialty || '',
      phone: vet.phone || '',
      active: vet.active
    };
    this.showForm = true;
  }

  save(): void {
    this.error = '';
    if (!this.form.name.trim()) {
      this.error = 'Nome é obrigatório.';
      return;
    }
    this.saving = true;
    const data = {
      name: this.form.name.trim(),
      crmv: this.form.crmv || undefined,
      specialty: this.form.specialty || undefined,
      phone: this.form.phone || undefined,
      active: this.form.active
    };
    const req = this.editingId
      ? this.vetService.update(this.editingId, data)
      : this.vetService.create(data as Omit<Vet, 'id' | 'createdAt'>);
    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.success = this.editingId ? 'Veterinário atualizado.' : 'Veterinário cadastrado.';
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.error || 'Erro ao salvar veterinário.';
      }
    });
  }

  toggleActive(vet: Vet): void {
    this.vetService.update(vet.id, { ...vet, active: !vet.active }).pipe(takeUntil(this.destroy$)).subscribe({
      next: v => this.success = v.active ? `${v.name} reativado.` : `${v.name} desativado.`,
      error: err => this.error = err.error?.error || 'Erro ao atualizar veterinário.'
    });
  }

  remove(vet: Vet): void {
    if (!confirm(`Excluir o veterinário ${vet.name}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    this.vetService.remove(vet.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.success = `${vet.name} excluído.`,
      error: err => this.error = err.error?.error || 'Erro ao excluir veterinário.'
    });
  }

  trackById(_index: number, vet: Vet): number {
    return vet.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
