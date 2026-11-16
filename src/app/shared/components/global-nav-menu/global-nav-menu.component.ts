import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GlobalNavService } from '../../services/global-nav.service';
import { AuthService, User } from '../../services/auth.service';

export interface RouteItem {
  path: string;
  title: string;
  description: string;
  category: 'operacao' | 'cadastros' | 'financeiro' | 'publico';
  icon: string;
  badge?: string;
  badgeClass?: string;
  keywords: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-global-nav-menu',
  templateUrl: './global-nav-menu.component.html',
  styleUrls: ['./global-nav-menu.component.scss']
})
export class GlobalNavMenuComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  isOpen = false;
  searchQuery = '';
  selectedCategory: 'all' | 'operacao' | 'cadastros' | 'financeiro' | 'publico' = 'all';
  currentUser: User | null = null;
  private subs = new Subscription();

  readonly allRoutes: RouteItem[] = [
    // 1. Operação & Atendimento
    {
      path: '/dashboard/daily-queue',
      title: 'Esteira Delivery (Kanban)',
      description: 'Quadro visual de etapas do pet (Gaiola, Banho, Secagem, Finalizado)',
      category: 'operacao',
      icon: 'fas fa-columns',
      badge: 'Novo',
      badgeClass: 'badge-new',
      keywords: 'esteira delivery kanban banho tosa producao gaiola status fases'
    },
    {
      path: '/dashboard/daily-queue',
      title: 'Fila do Dia & Gaiolas',
      description: 'Entrada por ordem de chegada no balcão e alojamento',
      category: 'operacao',
      icon: 'fas fa-clipboard-list',
      badge: 'Balcão',
      badgeClass: 'badge-balcao',
      keywords: 'fila do dia gaiolas chegada atendimento ordem diario recepcao'
    },
    {
      path: '/dashboard/appointments',
      title: 'Agenda & Calendário',
      description: 'Grade horária de agendamentos e confirmações do dia',
      category: 'operacao',
      icon: 'fas fa-calendar-alt',
      badge: 'Equipe',
      badgeClass: 'badge-team',
      keywords: 'agenda agendamentos calendario horarios marcados reservas datas'
    },
    {
      path: '/dashboard/consultations',
      title: 'Consultório & Prontuários',
      description: 'Atendimentos clínicos, prontuários e prescrições médicas',
      category: 'operacao',
      icon: 'fas fa-stethoscope',
      badge: 'Clínica',
      badgeClass: 'badge-clinic',
      keywords: 'consultorio consultas medico veterinario prontuario receita prescricao saude diagnostico'
    },

    // 2. Central de Cadastros
    {
      path: '/dashboard/users',
      title: 'Funcionários & Equipe',
      description: 'Cargos (Tosador, Banhista, Recepção), comissões (%) e acessos',
      category: 'cadastros',
      icon: 'fas fa-user-tie',
      badge: 'Admin',
      badgeClass: 'badge-admin',
      adminOnly: true,
      keywords: 'funcionarios equipe tosador banhista recepcionista comissao usuarios colaboradores login'
    },
    {
      path: '/dashboard/medications',
      title: 'Medicamentos & Farmácia',
      description: 'Princípios ativos, estoque, dosagens e controle de receitas',
      category: 'cadastros',
      icon: 'fas fa-pills',
      badge: 'Novo',
      badgeClass: 'badge-new',
      keywords: 'medicamentos remedios farmacia principio ativo dosagem posologia receita comprimido vacinas'
    },
    {
      path: '/dashboard/vets',
      title: 'Médicos Veterinários',
      description: 'Corpo clínico, CRMV, especialidades e telefones',
      category: 'cadastros',
      icon: 'fas fa-user-md',
      badge: 'Admin',
      badgeClass: 'badge-admin',
      keywords: 'medicos veterinarios crmv especialidade plantao corpo clinico doutor doutora'
    },
    {
      path: '/dashboard/inventory',
      title: 'Produtos & Estoque',
      description: 'Rações, petiscos, higiene, preços e controle de estoque mínimo',
      category: 'cadastros',
      icon: 'fas fa-box',
      badge: 'Estoque',
      badgeClass: 'badge-balcao',
      keywords: 'produtos estoque racoes acessorios petiscos precos sku codigo barras reposicao'
    },
    {
      path: '/dashboard/services',
      title: 'Serviços & Preços',
      description: 'Tabela de serviços por porte e raça com tempos estimados',
      category: 'cadastros',
      icon: 'fas fa-concierge-bell',
      badge: 'Admin',
      badgeClass: 'badge-admin',
      adminOnly: true,
      keywords: 'servicos precos tabela porte raca tosa higienica hidratacao duracao procedimentos'
    },
    {
      path: '/dashboard/customers',
      title: 'Clientes & Fichas de Pets',
      description: 'Fichas completas de tutores, pets, raças e históricos',
      category: 'cadastros',
      icon: 'fas fa-users',
      badge: 'Balcão',
      badgeClass: 'badge-balcao',
      keywords: 'clientes pets tutores cadastro animais cachorros gatos historico telefone ficha'
    },

    // 3. Financeiro & Gestão
    {
      path: '/dashboard/cash',
      title: 'Frente de Caixa (PDV)',
      description: 'Fluxo financeiro, recebimentos Pix/Cartão, sangrias e fechamento',
      category: 'financeiro',
      icon: 'fas fa-cash-register',
      badge: 'Balcão',
      badgeClass: 'badge-balcao',
      adminOnly: true,
      keywords: 'caixa pdv frente sangria fechamento pagamento pix dinheiro cartao balcao'
    },
    {
      path: '/dashboard/reports',
      title: 'Balanço & Relatórios',
      description: 'Indicadores de faturamento, receita por serviço e balanço contábil',
      category: 'financeiro',
      icon: 'fas fa-chart-line',
      badge: 'Admin',
      badgeClass: 'badge-admin',
      adminOnly: true,
      keywords: 'balanco relatorios faturamento receita metricas graficos exportar financeiro lucro'
    },
    {
      path: '/dashboard/orders',
      title: 'Gestão de Pedidos',
      description: 'Acompanhamento de pedidos da loja e compras no balcão',
      category: 'financeiro',
      icon: 'fas fa-shopping-bag',
      badge: 'Equipe',
      badgeClass: 'badge-team',
      keywords: 'pedidos vendas loja balcao status expedicao entrega faturamento'
    },

    // 4. Loja & Área Pública
    {
      path: '/',
      title: 'Home / Início do Site',
      description: 'Página inicial com destaques, promoções e apresentação',
      category: 'publico',
      icon: 'fas fa-home',
      badge: 'Público',
      badgeClass: 'badge-public',
      keywords: 'home inicio site publico capa institucional portal'
    },
    {
      path: '/services',
      title: 'Catálogo de Serviços',
      description: 'Visualização pública de banhos, tosas e estética pet',
      category: 'publico',
      icon: 'fas fa-cut',
      badge: 'Público',
      badgeClass: 'badge-public',
      keywords: 'servicos banho tosa catalogo publico precos estetica cliente'
    },
    {
      path: '/products',
      title: 'Loja Virtual de Produtos',
      description: 'Vitrine de produtos, rações e acessórios para compra',
      category: 'publico',
      icon: 'fas fa-store',
      badge: 'Público',
      badgeClass: 'badge-public',
      keywords: 'produtos loja vitrine compras catalogo online racao brinquedo e-commerce'
    },
    {
      path: '/appointments',
      title: 'Agendamento Online do Tutor',
      description: 'Formulário autônomo para o cliente agendar banho ou consulta',
      category: 'publico',
      icon: 'fas fa-calendar-check',
      badge: 'Tutor',
      badgeClass: 'badge-tutor',
      keywords: 'agendamento online tutor marcar banho tosa consulta cliente horario'
    }
  ];

  constructor(
    private globalNavService: GlobalNavService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.globalNavService.isOpen$.subscribe(open => {
        this.isOpen = open;
        if (open) {
          setTimeout(() => {
            this.searchInput?.nativeElement.focus();
          }, 100);
        } else {
          this.searchQuery = '';
          this.selectedCategory = 'all';
        }
      })
    );

    this.subs.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get filteredRoutes(): RouteItem[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.allRoutes.filter(item => {
      // Filtro de permissão
      if (item.adminOnly && this.currentUser?.role !== 'admin') {
        return false;
      }
      // Filtro de categoria
      if (this.selectedCategory !== 'all' && item.category !== this.selectedCategory) {
        return false;
      }
      // Filtro de texto/busca
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q)
      );
    });
  }

  getRoutesByCategory(cat: 'operacao' | 'cadastros' | 'financeiro' | 'publico'): RouteItem[] {
    return this.filteredRoutes.filter(r => r.category === cat);
  }

  get totalCount(): number {
    return this.filteredRoutes.length;
  }

  setCategory(cat: 'all' | 'operacao' | 'cadastros' | 'financeiro' | 'publico'): void {
    this.selectedCategory = cat;
  }

  navigate(path: string): void {
    this.globalNavService.close();
    this.router.navigateByUrl(path);
  }

  close(): void {
    this.globalNavService.close();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchInput?.nativeElement.focus();
  }
}
