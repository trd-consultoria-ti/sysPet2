import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  name: string = '';
  isRegisterMode = false;
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

  onSubmit(): void {
    this.loading = true;
    this.error = '';

    const request$ = this.isRegisterMode
      ? this.authService.register(this.name, this.email, this.password)
      : this.authService.login(this.email, this.password);

    request$.subscribe({
      next: () => {
        this.router.navigate([this.returnUrl]);
      },
      error: err => {
        this.error = this.isRegisterMode
          ? (err.error?.error || 'Não foi possível criar a conta. Verifique os dados.')
          : 'Falha na autenticação. Verifique suas credenciais.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
}