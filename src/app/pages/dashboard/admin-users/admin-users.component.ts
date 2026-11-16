import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, User } from '../../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  users: User[] = [];
  filteredUsers: User[] = [];
  showForm = false;
  editingUser: User | null = null;
  error = '';
  success = '';
  userForm: FormGroup;

  searchTerm = '';
  selectedRoleFilter = 'todos';

  readonly roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'collaborator', label: 'Funcionário / Equipe' },
    { value: 'customer', label: 'Cliente (Acesso Web)' }
  ];

  readonly jobTitles = [
    'Tosador / Banhista',
    'Médico Veterinário',
    'Recepcionista / Balcão',
    'Atendente de Loja',
    'Gerente Geral',
    'Auxiliar Veterinário',
    'Motorista (Leva e Traz)',
    'Outro'
  ];

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['collaborator', Validators.required],
      jobTitle: ['Tosador / Banhista'],
      phone: [''],
      commissionRate: [0, [Validators.min(0), Validators.max(100)]],
      canManageProducts: [false],
      active: [true]
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.authService.listUsers().pipe(takeUntil(this.destroy$)).subscribe({
      next: u => {
        this.users = u;
        this.applyFilter();
      },
      error: () => this.error = 'Erro ao carregar lista de usuários.'
    });
  }

  applyFilter(): void {
    let list = [...this.users];
    if (this.selectedRoleFilter !== 'todos') {
      list = list.filter(u => u.role === this.selectedRoleFilter);
    }
    if (this.searchTerm && this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(u =>
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.jobTitle && u.jobTitle.toLowerCase().includes(term))
      );
    }
    this.filteredUsers = list;
  }

  get totalEmployees(): number {
    return this.users.filter(u => u.role === 'collaborator' || u.role === 'admin').length;
  }

  get totalGroomers(): number {
    return this.users.filter(u => u.jobTitle && u.jobTitle.toLowerCase().includes('tosa')).length;
  }

  get totalAdmins(): number {
    return this.users.filter(u => u.role === 'admin').length;
  }

  roleLabel(role: string): string {
    return this.roles.find(r => r.value === role)?.label || role;
  }

  openCreate(): void {
    this.editingUser = null;
    this.error = '';
    this.success = '';
    this.userForm.reset({
      name: '',
      email: '',
      password: '',
      role: 'collaborator',
      jobTitle: 'Tosador / Banhista',
      phone: '',
      commissionRate: 0,
      canManageProducts: false,
      active: true
    });
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showForm = true;
  }

  openEdit(user: User): void {
    this.editingUser = user;
    this.error = '';
    this.success = '';
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      jobTitle: user.jobTitle || 'Tosador / Banhista',
      phone: user.phone || '',
      commissionRate: user.commissionRate || 0,
      canManageProducts: !!user.canManageProducts,
      active: user.active !== false
    });
    // Ao editar, senha é opcional
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editingUser = null;
  }

  save(): void {
    if (this.userForm.invalid) return;
    this.error = '';
    const val = this.userForm.value;

    if (this.editingUser) {
      const updatePayload: any = {
        name: val.name,
        email: val.email,
        role: val.role,
        jobTitle: val.jobTitle,
        phone: val.phone,
        commissionRate: Number(val.commissionRate) || 0,
        canManageProducts: !!val.canManageProducts,
        active: val.active !== false
      };
      if (val.password && val.password.trim()) {
        updatePayload.password = val.password;
      }
      this.authService.updateUser(this.editingUser.id, updatePayload).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showForm = false;
          this.editingUser = null;
          this.success = 'Colaborador atualizado com sucesso!';
          this.load();
          setTimeout(() => this.success = '', 3000);
        },
        error: err => this.error = err.error?.error || 'Erro ao atualizar colaborador'
      });
    } else {
      this.authService.createUser(val).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.showForm = false;
          this.success = 'Funcionário cadastrado com sucesso!';
          this.load();
          setTimeout(() => this.success = '', 3000);
        },
        error: err => this.error = err.error?.error || 'Erro ao cadastrar funcionário'
      });
    }
  }

  changeRole(user: User, role: string): void {
    this.authService.updateUser(user.id, { role: role as User['role'] }).pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  toggleProductPermission(user: User, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.authService.updateUser(user.id, { canManageProducts: checked }).pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
