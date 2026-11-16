import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  email: string = '';
  password: string = '';
  name: string = '';
  isRegisterMode = false;
  acceptTerms = false;
  returnUrl: string = '/';
  loading: boolean = false;
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    // Obter URL de retorno dos parâmetros da rota ou usar o padrão '/'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
    
    // Verificar se o usuário já está logado
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.error = '';
  }

  forgot(): void {
    this.error = '';
    if (!this.email) {
      this.error = 'Informe seu email para recuperar a senha.';
      return;
    }
    this.loading = true;
    this.authService.forgotPassword(this.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.error = '';
          this.loading = false;
          alert('Se o email estiver cadastrado, enviaremos as instruções de recuperação.');
        },
        error: () => {
          this.error = 'Não foi possível processar a solicitação. Tente novamente.';
          this.loading = false;
        }
      });
  }

  onSubmit(): void {
    this.error = '';
    if (this.isRegisterMode && !this.acceptTerms) {
      this.error = 'É necessário aceitar os termos e a política de privacidade.';
      return;
    }
    this.loading = true;

    const request$ = this.isRegisterMode
      ? this.authService.register(this.name, this.email, this.password, this.acceptTerms)
      : this.authService.login(this.email, this.password);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.router.navigate([this.returnUrl]);
      },
      error: err => {
        this.error = err.error?.error || (this.isRegisterMode
          ? 'Não foi possível criar a conta. Verifique os dados.'
          : 'Falha na autenticação. Verifique suas credenciais.');
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}