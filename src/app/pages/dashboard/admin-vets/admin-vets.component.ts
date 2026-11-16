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

  constructor(private vetService: VetService, private authService: AuthService) {}

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
