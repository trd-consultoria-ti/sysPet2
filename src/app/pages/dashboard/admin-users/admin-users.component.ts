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
  showForm = false;
  error = '';
  userForm: FormGroup;

  readonly roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'collaborator', label: 'Funcionário' },
    { value: 'customer', label: 'Cliente' }
  ];

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['collaborator', Validators.required],
      canManageProducts: [false]
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.authService.listUsers().pipe(takeUntil(this.destroy$)).subscribe(u => this.users = u);
  }

  roleLabel(role: string): string {
    return this.roles.find(r => r.value === role)?.label || role;
  }

  openCreate(): void {
    this.error = '';
    this.userForm.reset({ name: '', email: '', password: '', role: 'collaborator', canManageProducts: false });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (this.userForm.invalid) return;
    this.error = '';
    this.authService.createUser(this.userForm.value).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showForm = false;
        this.load();
      },
      error: err => this.error = err.error?.error || 'Erro ao cadastrar usuário'
    });
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
