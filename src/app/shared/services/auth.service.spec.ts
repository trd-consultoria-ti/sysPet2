import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, User } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const fakeUser: User = {
    id: 1,
    name: 'Maria',
    email: 'maria@teste.com',
    role: 'customer',
    token: 'tok-123'
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('deve iniciar deslogado', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getCurrentUser()).toBeNull();
  });

  it('login define usuário atual e marca logado', () => {
    service.login('maria@teste.com', 'senha').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(fakeUser);

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getCurrentUser()?.email).toBe('maria@teste.com');
  });

  it('register define usuário atual', () => {
    service.register('Maria', 'maria@teste.com', 'senha', true).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/auth/register`);
    expect(req.request.method).toBe('POST');
    req.flush(fakeUser);

    expect(service.getCurrentUser()?.name).toBe('Maria');
  });

  it('logout limpa sessão local e revoga no servidor', () => {
    service.login('maria@teste.com', 'senha').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(fakeUser);

    service.logout();
    http.expectOne(`${environment.apiUrl}/auth/logout`).flush({});

    expect(service.isLoggedIn()).toBeFalse();
    expect(service.getCurrentUser()).toBeNull();
  });

  it('isAdmin e isCollaborator respeitam role', () => {
    service.login('a@a.com', 'x').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ ...fakeUser, role: 'admin' });
    expect(service.isAdmin()).toBeTrue();

    service.logout();
    http.expectOne(`${environment.apiUrl}/auth/logout`).flush({});

    service.login('a@a.com', 'x').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({ ...fakeUser, role: 'collaborator' });
    expect(service.isAdmin()).toBeFalse();
    expect(service.isCollaborator()).toBeTrue();
  });
});
