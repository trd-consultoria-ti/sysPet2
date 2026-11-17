import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../shared/services/auth.service';
import { GlobalNavService } from '../../../shared/services/global-nav.service';

export interface SitemapSection {
  title: string;
  icon: string;
  colorClass: string;
  description: string;
  items: SitemapItem[];
}

export interface SitemapItem {
  title: string;
  path: string;
  description: string;
  icon: string;
  badge: string;
  badgeClass: string;
  permission: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-admin-system-map',
  templateUrl: './admin-system-map.component.html',
  styleUrls: ['./admin-system-map.component.scss']
})
export class AdminSystemMapComponent implements OnInit {
  currentUser: User | null = null;
  searchFilter = '';

  readonly sections: SitemapSection[] = [
    {
      title: 'Operação, Banho & Tosa e Clínica',
      icon: 'fas fa-cut',
      colorClass: 'section-operacao',
      description: 'Módulos de atendimento em tempo real, esteira de produção e cuidados médicos com os pets.',
      items: [
        {
          title: 'Esteira Delivery (Kanban de Banho & Tosa)',
          path: '/dashboard/daily-queue',
          description: 'Quadro Kanban com 5 colunas de produção: Na Gaiola ➔ Banho ➔ Secagem/Tosa ➔ Pronto ➔ Entregue, com previsão ETA de saída e validação humana obrigatória de tosa.',
          icon: 'fas fa-columns',
          badge: 'Esteira',
          badgeClass: 'badge-new',
          permission: 'Recepção, Banhista, Tosador & Admin'
        },
        {
          title: 'Pacotes Mensais & Créditos',
          path: '/dashboard/packages',
          description: 'Gestão de planos recorrentes (ex: 4 banhos + 1 tosa), venda de pacotes, monitor de saldos e débito automático no check-in.',
          icon: 'fas fa-cubes',
          badge: 'Novo',
          badgeClass: 'badge-new',
          permission: 'Recepção & Admin'
        },
        {
          title: 'Táxi Dog (Corridas & Regiões)',
          path: '/dashboard/taxi',
          description: 'Controle de transporte pet com corridas vinculadas ao banho/tosa, tabela de preços por região e avisos de motorista a caminho no WhatsApp.',
          icon: 'fas fa-car-side',
          badge: 'Logística',
          badgeClass: 'badge-team',
          permission: 'Recepção, Motorista & Admin'
        },
        {
          title: 'Central de Atendimento WhatsApp',
          path: '/dashboard/whatsapp',
          description: 'Caixa de entrada integrada (Evolution API), conversas ativas, respostas rápidas e assistente de cotação inteligente por porte e raça.',
          icon: 'fab fa-whatsapp',
          badge: 'Comunicação',
          badgeClass: 'badge-balcao',
          permission: 'Recepção & Atendimento'
        },
        {
          title: 'Consultório Veterinário & Pronto Atendimento',
          path: '/dashboard/consultations',
          description: 'Prontuários clínicos, triagem com fila por ordem de chegada presencial, carteira oficial de vacinas e receitas em formato oficial A4.',
          icon: 'fas fa-stethoscope',
          badge: 'Clínica',
          badgeClass: 'badge-clinic',
          permission: 'Médicos Veterinários & Admin'
        },
        {
          title: 'Agenda & Calendário de Horários',
          path: '/dashboard/appointments',
          description: 'Grade de agendamentos diários e semanais, confirmações e histórico de serviços marcados.',
          icon: 'fas fa-calendar-alt',
          badge: 'Equipe',
          badgeClass: 'badge-team',
          permission: 'Recepção & Equipe'
        }
      ]
    },
    {
      title: 'Central de Cadastros do Sistema',
      icon: 'fas fa-folder-open',
      colorClass: 'section-cadastros',
      description: 'Configuração mestra e cadastro de colaboradores, farmácia veterinária, estoque, tabela de preços e clientes.',
      items: [
        {
          title: 'Produtos, Estoque & Reposição',
          path: '/dashboard/inventory',
          description: 'Gestão de rações e acessórios com controle de estoque mínimo de segurança, reposição/entrada de mercadorias e fornecedores.',
          icon: 'fas fa-box',
          badge: 'Estoque',
          badgeClass: 'badge-balcao',
          permission: 'Estoquista, Recepção & Admin'
        },
        {
          title: 'Serviços, Procedimentos & Tabela de Preços',
          path: '/dashboard/services',
          description: 'Matriz de preços itemizada por porte (pequeno, médio, grande), regras para raças especiais e serviços extras somáveis.',
          icon: 'fas fa-concierge-bell',
          badge: 'Admin',
          badgeClass: 'badge-admin',
          permission: 'Somente Administrador',
          adminOnly: true
        },
        {
          title: 'Clientes & Fichas de Pets',
          path: '/dashboard/customers',
          description: 'Cadastro completo de tutores e animais com controle de peso em kg, porte derivado automático, histórico e contatos.',
          icon: 'fas fa-users',
          badge: 'Balcão',
          badgeClass: 'badge-balcao',
          permission: 'Recepção, Atendimento & Admin'
        },
        {
          title: 'Funcionários & Equipe',
          path: '/dashboard/users',
          description: 'Gestão de colaboradores: Tosadores, Banhistas, Recepcionistas, Veterinários, controle de acessos e cargos.',
          icon: 'fas fa-user-tie',
          badge: 'Admin',
          badgeClass: 'badge-admin',
          permission: 'Somente Administrador',
          adminOnly: true
        },
        {
          title: 'Medicamentos & Farmácia Veterinária',
          path: '/dashboard/medications',
          description: 'Catálogo de remédios veterinários: princípios ativos, posologias padrão sugeridas, retenção de receita obrigatória e estoque.',
          icon: 'fas fa-pills',
          badge: 'Farmácia',
          badgeClass: 'badge-clinic',
          permission: 'Equipe Clínica & Admin'
        },
        {
          title: 'Médicos Veterinários',
          path: '/dashboard/vets',
          description: 'Cadastro do corpo clínico: CRMV com UF, especialidades médicas veterinárias, escalas de plantão e contatos.',
          icon: 'fas fa-user-md',
          badge: 'Admin',
          badgeClass: 'badge-admin',
          permission: 'Somente Administrador'
        }
      ]
    },
    {
      title: 'Financeiro, Vendas & Gestão',
      icon: 'fas fa-chart-pie',
      colorClass: 'section-financeiro',
      description: 'Gestão de frente de caixa, pagamentos balcão, contas a pagar, comissões e fechamento contábil.',
      items: [
        {
          title: 'Frente de Caixa (PDV Balcão Rápido)',
          path: '/dashboard/cash',
          description: 'Terminal expresso de vendas com busca de produtos, conferência de estoque, troco em dinheiro, Pix, Cartão e emissão de comprovante.',
          icon: 'fas fa-cash-register',
          badge: 'Balcão',
          badgeClass: 'badge-balcao',
          permission: 'Operadores de Caixa & Admin',
          adminOnly: true
        },
        {
          title: 'Contas a Pagar & Despesas',
          path: '/dashboard/cash',
          description: 'Controle de obrigações com fornecedores e despesas da clínica, com quitação e lançamento automático de saída no caixa.',
          icon: 'fas fa-file-invoice-dollar',
          badge: 'Financeiro',
          badgeClass: 'badge-admin',
          permission: 'Operadores de Caixa & Admin',
          adminOnly: true
        },
        {
          title: 'Fechamento Consolidado do Dia',
          path: '/dashboard/cash',
          description: 'Balanço diário integrando receita da esteira de banho e tosa, corridas de táxi dog, vendas de balcão e comissões da equipe.',
          icon: 'fas fa-clipboard-check',
          badge: 'Fechamento',
          badgeClass: 'badge-admin',
          permission: 'Operadores de Caixa & Admin',
          adminOnly: true
        },
        {
          title: 'Tosadores & Comissões',
          path: '/dashboard/groomers',
          description: 'Gestão de tosadores, comissão padrão de 15%, rateio igualitário em duplas (7,5% cada) e integração com Contas a Pagar.',
          icon: 'fas fa-scissors',
          badge: 'Equipe',
          badgeClass: 'badge-team',
          permission: 'Somente Administrador',
          adminOnly: true
        },
        {
          title: 'Configurações da Empresa',
          path: '/dashboard/settings',
          description: 'Dados cadastrais da empresa (CNPJ, CRMV, razão social, endereço e contatos) nos documentos e grade de horários com limite diário de vagas.',
          icon: 'fas fa-sliders-h',
          badge: 'Admin',
          badgeClass: 'badge-admin',
          permission: 'Somente Administrador',
          adminOnly: true
        },
        {
          title: 'Balanço & Relatórios Financeiros',
          path: '/dashboard/reports',
          description: 'Relatórios consolidados de faturamento, receita por categoria de serviço de banho/tosa e exportação contábil.',
          icon: 'fas fa-chart-line',
          badge: 'Admin',
          badgeClass: 'badge-admin',
          permission: 'Somente Administrador',
          adminOnly: true
        },
        {
          title: 'Gestão de Pedidos da Loja',
          path: '/dashboard/orders',
          description: 'Acompanhamento do ciclo de vida de pedidos online e vendas diretas do balcão.',
          icon: 'fas fa-shopping-bag',
          badge: 'Equipe',
          badgeClass: 'badge-team',
          permission: 'Recepção & Equipe'
        }
      ]
    },
    {
      title: 'Loja Virtual & Área do Tutor (Público)',
      icon: 'fas fa-store',
      colorClass: 'section-publico',
      description: 'Canais de autoatendimento onde o tutor pesquisa serviços, compra produtos e agenda horários.',
      items: [
        {
          title: 'Home / Página Inicial',
          path: '/',
          description: 'Página inicial do site do Animal World com serviços em destaque, diferenciais e promoções.',
          icon: 'fas fa-home',
          badge: 'Público',
          badgeClass: 'badge-public',
          permission: 'Acesso Livre'
        },
        {
          title: 'Catálogo de Serviços Pet',
          path: '/services',
          description: 'Visualização pública de banhos especiais, hidratações, tosas da raça e procedimentos.',
          icon: 'fas fa-cut',
          badge: 'Público',
          badgeClass: 'badge-public',
          permission: 'Acesso Livre'
        },
        {
          title: 'Loja Virtual de Produtos',
          path: '/products',
          description: 'Vitrine de e-commerce com filtros de categoria, rações premium e acessórios.',
          icon: 'fas fa-store',
          badge: 'Público',
          badgeClass: 'badge-public',
          permission: 'Acesso Livre'
        },
        {
          title: 'Agendamento Online do Tutor',
          path: '/appointments',
          description: 'Canal de autoatendimento onde o cliente escolhe o pet, o serviço e o melhor horário.',
          icon: 'fas fa-calendar-check',
          badge: 'Tutor',
          badgeClass: 'badge-tutor',
          permission: 'Clientes Cadastrados'
        },
        {
          title: 'Carrinho de Compras & Checkout',
          path: '/cart',
          description: 'Finalização de pedidos da loja com cupom de desconto e pagamento seguro.',
          icon: 'fas fa-shopping-cart',
          badge: 'Tutor',
          badgeClass: 'badge-tutor',
          permission: 'Clientes Cadastrados'
        },
        {
          title: 'Minha Conta & Meus Pets',
          path: '/account',
          description: 'Área do tutor para gerenciar dados pessoais, histórico de serviços e cadastro de seus pets.',
          icon: 'fas fa-user-circle',
          badge: 'Tutor',
          badgeClass: 'badge-tutor',
          permission: 'Clientes Cadastrados'
        }
      ]
    }
  ];

  constructor(
    private authService: AuthService,
    private globalNavService: GlobalNavService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(u => this.currentUser = u);
  }

  openGlobalNav(): void {
    this.globalNavService.open();
  }

  navigate(path: string): void {
    this.router.navigateByUrl(path);
  }

  getFilteredItems(section: SitemapSection): SitemapItem[] {
    const q = this.searchFilter.toLowerCase().trim();
    return section.items.filter(item => {
      if (item.adminOnly && this.currentUser?.role !== 'admin') {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
      );
    });
  }
}
