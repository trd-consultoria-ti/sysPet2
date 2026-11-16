import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpInterceptor, HttpEvent } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

const STORAGE_KEY = 'syspet_prod_db_v1';

interface DbState {
  users: any[];
  products: any[];
  services: any[];
  customers: any[];
  pets: any[];
  appointments: any[];
  orders: any[];
  vets: any[];
  consultations: any[];
  prescriptions: any[];
  coupons: any[];
  cash: any[];
  audit: any[];
  dailyServices: any[];
  medications: any[];
}

function getInitialDbState(): DbState {
  return {
    users: [
      {
        id: 1,
        name: 'Admin Animal World',
        email: 'admin@animalworld.com',
        password: 'animal123',
        role: 'admin',
        canManageProducts: true,
        token: 'prod-demo-admin-token-' + Date.now()
      }
    ],
    products: [
      {
        id: 1,
        name: 'Ração Premium para Cães',
        price: 89.9,
        rating: 4.8,
        reviews: 124,
        image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        category: 'Alimentos',
        description: 'Ração premium para cães adultos de todas as raças. Rica em nutrientes essenciais.',
        stock: 50
      },
      {
        id: 2,
        name: 'Brinquedo Interativo para Gatos',
        price: 49.9,
        rating: 4.6,
        reviews: 87,
        image: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1374&q=80',
        category: 'Brinquedos',
        description: 'Brinquedo interativo que estimula o instinto de caça dos felinos.',
        stock: 30
      },
      {
        id: 3,
        name: 'Coleira Ajustável com GPS',
        price: 129.9,
        rating: 4.9,
        reviews: 56,
        image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?ixlib=rb-4.0.3&auto=format&fit=crop&w=1364&q=80',
        category: 'Acessórios',
        description: 'Coleira ajustável com GPS integrado para monitorar a localização do seu pet.',
        stock: 15
      },
      {
        id: 4,
        name: 'Shampoo Hipoalergênico',
        price: 39.9,
        rating: 4.7,
        reviews: 92,
        image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1498&q=80',
        category: 'Higiene',
        description: 'Shampoo hipoalergênico para pets com pele sensível. Fórmula suave e sem parabenos.',
        stock: 40
      },
      {
        id: 5,
        name: 'Casaco de Inverno para Cães',
        price: 79.9,
        rating: 4.5,
        reviews: 45,
        image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        category: 'Roupas',
        description: 'Casaco térmico para cães, ideal para dias frios. Material impermeável e confortável.',
        stock: 20
      },
      {
        id: 6,
        name: 'Cama Ortopédica para Pets',
        price: 159.9,
        rating: 4.8,
        reviews: 78,
        image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?ixlib=rb-4.0.3&auto=format&fit=crop&w=1460&q=80',
        category: 'Camas',
        description: 'Cama ortopédica que proporciona suporte adequado para pets de todas as idades.',
        stock: 12
      },
      {
        id: 7,
        name: 'Suplemento Vitamínico',
        price: 69.9,
        rating: 4.6,
        reviews: 63,
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        category: 'Medicamentos',
        description: 'Suplemento vitamínico para fortalecer o sistema imunológico do seu pet.',
        stock: 25
      },
      {
        id: 8,
        name: 'Escova Removedora de Pelos',
        price: 45.9,
        rating: 4.4,
        reviews: 52,
        image: 'https://images.unsplash.com/photo-1560743641-3914f2c45636?ixlib=rb-4.0.3&auto=format&fit=crop&w=1587&q=80',
        category: 'Acessórios',
        description: 'Escova eficiente para remover pelos soltos e reduzir a queda de pelos em casa.',
        stock: 35
      }
    ],
    services: [
      {
        id: 1,
        name: 'Banho Completo',
        price: 79.9,
        rating: 4.9,
        reviews: 154,
        image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1471&q=80',
        category: 'Banho e Tosa',
        duration: '1 hora',
        description: 'Banho completo com shampoo especial, secagem, escovação e perfume.'
      },
      {
        id: 2,
        name: 'Tosa Higiênica',
        price: 59.9,
        rating: 4.7,
        reviews: 98,
        image: 'https://images.unsplash.com/photo-1541364983171-a8ba01e95cfc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1587&q=80',
        category: 'Banho e Tosa',
        duration: '45 min',
        description: 'Tosa das regiões íntimas, patas e face do animal para maior higiene e conforto.'
      },
      {
        id: 3,
        name: 'Consulta Veterinária',
        price: 129.9,
        rating: 4.8,
        reviews: 112,
        image: 'https://images.unsplash.com/photo-1603123853880-a92fafb7809f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1587&q=80',
        category: 'Veterinário',
        duration: '30 min',
        description: 'Consulta com veterinário para avaliar a saúde geral do seu pet.'
      },
      {
        id: 4,
        name: 'Taxi Dog',
        price: 49.9,
        rating: 4.6,
        reviews: 89,
        image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1586&q=80',
        category: 'Taxi Dog',
        duration: 'Variável',
        description: 'Transporte seguro e confortável para seu pet para qualquer lugar da cidade.'
      },
      {
        id: 5,
        name: 'Hospedagem Pet',
        price: 89.9,
        rating: 4.9,
        reviews: 76,
        image: 'https://images.unsplash.com/photo-1596854273338-cbf078ec7071?ixlib=rb-4.0.3&auto=format&fit=crop&w=1480&q=80',
        category: 'Hospedagem',
        duration: 'Diária',
        description: 'Acomodação confortável para seu pet com monitoramento 24 horas.'
      },
      {
        id: 6,
        name: 'Adestramento Básico',
        price: 149.9,
        rating: 4.7,
        reviews: 62,
        image: 'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
        category: 'Adestramento',
        duration: '1 hora',
        description: 'Sessão de adestramento para ensinar comandos básicos de obediência.'
      },
      {
        id: 7,
        name: 'Spa Pet',
        price: 119.9,
        rating: 4.8,
        reviews: 45,
        image: 'https://images.unsplash.com/photo-1535294435445-d7249524ef2e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        category: 'Spa',
        duration: '2 horas',
        description: 'Tratamento completo de relaxamento com massagem, aromaterapia e hidratação.'
      },
      {
        id: 8,
        name: 'Creche Diária',
        price: 69.9,
        rating: 4.6,
        reviews: 58,
        image: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?ixlib=rb-4.0.3&auto=format&fit=crop&w=1523&q=80',
        category: 'Creche',
        duration: 'Diária',
        description: 'Um dia inteiro de diversão e socialização para seu pet enquanto você trabalha.'
      }
    ],
    customers: [
      {
        id: 1,
        name: 'Admin Animal World',
        email: 'admin@animalworld.com',
        phone: '+55 11 99999-9999',
        status: 'active',
        userId: 1,
        pets: [
          { id: 1, customerId: 1, name: 'Bruce', type: 'Cachorro', breed: 'Golden Retriever', age: 3, weightKg: 32.5 }
        ]
      },
      {
        id: 2,
        name: 'Maria Silva',
        email: 'maria.silva@example.com',
        phone: '+55 11 98765-4321',
        status: 'active',
        pets: [
          { id: 2, customerId: 2, name: 'Rex', type: 'Cachorro', breed: 'Labrador', age: 4, weightKg: 28.0 },
          { id: 3, customerId: 2, name: 'Luna', type: 'Cachorro', breed: 'Poodle', age: 2, weightKg: 6.5 }
        ]
      },
      {
        id: 3,
        name: 'João Santos',
        email: 'joao.santos@example.com',
        phone: '+55 11 91234-5678',
        status: 'active',
        pets: [
          { id: 4, customerId: 3, name: 'Mia', type: 'Gato', breed: 'Siamês', age: 1, weightKg: 4.2 }
        ]
      }
    ],
    pets: [
      { id: 1, customerId: 1, name: 'Bruce', type: 'Cachorro', breed: 'Golden Retriever', age: 3, weightKg: 32.5 },
      { id: 2, customerId: 2, name: 'Rex', type: 'Cachorro', breed: 'Labrador', age: 4, weightKg: 28.0 },
      { id: 3, customerId: 2, name: 'Luna', type: 'Cachorro', breed: 'Poodle', age: 2, weightKg: 6.5 },
      { id: 4, customerId: 3, name: 'Mia', type: 'Gato', breed: 'Siamês', age: 1, weightKg: 4.2 }
    ],
    appointments: [
      {
        id: 1,
        userId: 1,
        userName: 'Admin Animal World',
        customerId: 1,
        customerName: 'Admin Animal World',
        petName: 'Bruce',
        serviceId: 1,
        serviceName: 'Banho Completo',
        date: '2026-11-20',
        time: '10:00',
        status: 'confirmado',
        notes: 'Agendamento inicial do sistema',
        createdAt: new Date().toISOString()
      }
    ],
    orders: [
      {
        id: 1,
        orderNumber: 'ORD-2026-0001',
        userId: 1,
        customerName: 'Admin Animal World',
        email: 'admin@animalworld.com',
        phone: '+55 11 99999-9999',
        address: 'Av. Paulista, 1000',
        paymentMethod: 'pix',
        items: [
          { productId: 1, name: 'Ração Premium para Cães', price: 89.9, quantity: 1 }
        ],
        total: 89.9,
        discount: 0,
        status: 'pago',
        createdAt: new Date().toISOString()
      }
    ],
    vets: [
      { id: 1, name: 'Dr. Pedro Rocha', crmv: '12345-SP', specialty: 'Clínica Geral', phone: '+55 11 98888-7777', active: true },
      { id: 2, name: 'Dra. Camila Lima', crmv: '67890-SP', specialty: 'Dermatologia', phone: '+55 11 97777-6666', active: true }
    ],
    consultations: [
      {
        id: 1,
        petId: 1,
        petName: 'Bruce',
        vetId: 1,
        vetName: 'Dr. Pedro Rocha',
        scheduledDate: '2026-11-22',
        scheduledTime: '14:30',
        status: 'agendado',
        reason: 'Consulta de rotina anual',
        weight: 32.5,
        temperature: 38.5,
        diagnosis: 'Animal saudável e ativo',
        notes: 'Vacinas em dia.',
        createdAt: new Date().toISOString()
      }
    ],
    prescriptions: [],
    coupons: [
      { id: 1, code: 'BEMVINDO10', discountType: 'percent', discountValue: 10, minOrderTotal: 50, active: true, usedCount: 3 },
      { id: 2, code: 'PET20', discountType: 'fixed', discountValue: 20, minOrderTotal: 100, active: true, usedCount: 1 }
    ],
    cash: [
      { id: 1, type: 'entrada', description: 'Venda de produtos #ORD-2026-0001', amount: 89.9, paymentMethod: 'pix', createdAt: new Date().toISOString() }
    ],
    audit: [
      { id: 1, entity: 'orders', entityId: 1, action: 'create', userName: 'Admin Animal World', userEmail: 'admin@animalworld.com', createdAt: new Date().toISOString() }
    ],
    dailyServices: [
      {
        id: 1,
        appointmentId: null,
        customerId: 1,
        customerName: 'Maria Silva',
        phone: '+55 11 98765-4321',
        petId: 1,
        petName: 'Rex',
        petBreed: 'Labrador',
        petWeightKg: 28.0,
        petSizeTier: 'grande',
        serviceId: 1,
        serviceName: 'Banho Completo',
        selectedExtras: ['unhas'],
        date: new Date().toISOString().split('T')[0],
        queueOrder: 1,
        status: 'em_atendimento',
        healthChecklist: { skin_lesion: false, parasites: false, paw_lesion: false },
        notes: 'Pet dócil, usar shampoo neutro',
        tosaNotes: '',
        estimatedPrice: 120.0,
        finalPrice: null,
        cageNumber: 'Box 02',
        groomerName: 'Carlos Tosador',
        requiresValidation: false,
        validationConfirmed: true,
        validatedBy: null,
        validatedAt: null,
        estimatedReadyAt: '15h30',
        checkinAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        readyAt: null,
        deliveredAt: null
      },
      {
        id: 2,
        appointmentId: null,
        customerId: 2,
        customerName: 'João Santos',
        phone: '+55 11 91234-5678',
        petId: 3,
        petName: 'Mia',
        petBreed: 'Siamês',
        petWeightKg: 4.2,
        petSizeTier: 'pequeno',
        serviceId: 2,
        serviceName: 'Tosa Higiênica',
        selectedExtras: [],
        date: new Date().toISOString().split('T')[0],
        queueOrder: 2,
        status: 'aguardando',
        healthChecklist: { skin_lesion: false, parasites: false, paw_lesion: false },
        notes: 'Atenção na patinha direita',
        tosaNotes: 'Tosa higiênica padrão, arredondar pezinhos',
        estimatedPrice: 60.0,
        finalPrice: null,
        cageNumber: 'Box 05',
        groomerName: 'Mariana',
        requiresValidation: true,
        validationConfirmed: false,
        validatedBy: null,
        validatedAt: null,
        estimatedReadyAt: '16h15',
        checkinAt: new Date(Date.now() - 1800000).toISOString(),
        startedAt: null,
        readyAt: null,
        deliveredAt: null
      },
      {
        id: 3,
        appointmentId: null,
        customerId: 3,
        customerName: 'Ana Oliveira',
        phone: '+55 11 99876-5432',
        petId: 4,
        petName: 'Bob',
        petBreed: 'Golden Retriever',
        petWeightKg: 31.0,
        petSizeTier: 'grande',
        serviceId: 1,
        serviceName: 'Banho Completo',
        selectedExtras: ['desembolo'],
        date: new Date().toISOString().split('T')[0],
        queueOrder: 3,
        status: 'pronto',
        healthChecklist: { skin_lesion: false, parasites: false, paw_lesion: false },
        notes: 'Pronto para retirada, tutor notificado',
        tosaNotes: '',
        estimatedPrice: 170.0,
        finalPrice: 170.0,
        cageNumber: 'Gaiola 01',
        groomerName: 'Carlos Tosador',
        requiresValidation: false,
        validationConfirmed: true,
        validatedBy: null,
        validatedAt: null,
        estimatedReadyAt: '16h45',
        checkinAt: new Date(Date.now() - 7200000).toISOString(),
        startedAt: new Date(Date.now() - 5400000).toISOString(),
        readyAt: new Date(Date.now() - 900000).toISOString(),
        deliveredAt: null
      }
    ],
    medications: [
      {
        id: 1,
        name: 'Apoquel 5.4mg',
        activePrinciple: 'Maleato de Oclacitinib',
        category: 'Anti-alérgico / Dermatológico',
        presentation: 'Comprimido',
        concentration: '5.4mg',
        price: 220.0,
        stock: 25,
        unit: 'cx',
        defaultDosage: '1 comprimido a cada 12 horas por 14 dias, depois 1 ao dia',
        requiresPrescription: true,
        active: true
      },
      {
        id: 2,
        name: 'Bravecto Cães 10 a 20kg',
        activePrinciple: 'Fluralaner',
        category: 'Antipulgas & Carrapatos',
        presentation: 'Mastigável',
        concentration: '500mg',
        price: 249.9,
        stock: 40,
        unit: 'un',
        defaultDosage: '1 comprimido mastigável dose única, proteção por 12 semanas',
        requiresPrescription: false,
        active: true
      },
      {
        id: 3,
        name: 'Simparic 20mg (10 a 20kg)',
        activePrinciple: 'Sarolaner',
        category: 'Antipulgas & Carrapatos',
        presentation: 'Comprimido',
        concentration: '20mg',
        price: 115.0,
        stock: 35,
        unit: 'cx',
        defaultDosage: '1 comprimido mastigável a cada 30 dias',
        requiresPrescription: false,
        active: true
      },
      {
        id: 4,
        name: 'Meloxicam 1mg',
        activePrinciple: 'Meloxicam',
        category: 'Anti-inflamatório & Analgésico',
        presentation: 'Comprimido',
        concentration: '1mg',
        price: 42.5,
        stock: 60,
        unit: 'cx',
        defaultDosage: '1 comprimido a cada 24 horas por 5 dias após refeição',
        requiresPrescription: true,
        active: true
      },
      {
        id: 5,
        name: 'Agemoxi CL 250mg',
        activePrinciple: 'Amoxicilina + Ácido Clavulânico',
        category: 'Antibiótico',
        presentation: 'Comprimido',
        concentration: '250mg',
        price: 68.0,
        stock: 30,
        unit: 'cx',
        defaultDosage: '1 comprimido a cada 12 horas por 7 a 10 dias consecutivos',
        requiresPrescription: true,
        active: true
      },
      {
        id: 6,
        name: 'Prednisolona 10mg',
        activePrinciple: 'Prednisolona',
        category: 'Anti-inflamatório / Corticoide',
        presentation: 'Comprimido',
        concentration: '10mg',
        price: 28.0,
        stock: 50,
        unit: 'cx',
        defaultDosage: '1/2 comprimido a cada 12 horas por 5 dias, depois desmame',
        requiresPrescription: true,
        active: true
      },
      {
        id: 7,
        name: 'Drontal Plus Cães 10kg',
        activePrinciple: 'Praziquantel + Pamoato de Pirantel + Febantel',
        category: 'Vermífugo',
        presentation: 'Comprimido',
        concentration: '660mg',
        price: 38.9,
        stock: 80,
        unit: 'cx',
        defaultDosage: '1 comprimido para cada 10kg de peso corporal em dose única, repetir em 15 dias',
        requiresPrescription: false,
        active: true
      },
      {
        id: 8,
        name: 'Otodem Plus 20ml',
        activePrinciple: 'Sulfametoxazol + Gentamicina + Fluocinolona',
        category: 'Otológico / Dermatológico',
        presentation: 'Gotas',
        concentration: '20ml',
        price: 56.0,
        stock: 20,
        unit: 'frasco',
        defaultDosage: '4 gotas em cada conduto auditivo a cada 12 horas por 7 dias após limpeza',
        requiresPrescription: true,
        active: true
      },
      {
        id: 9,
        name: 'Gaviz V 10mg',
        activePrinciple: 'Omeprazol',
        category: 'Protetor Gástrico',
        presentation: 'Comprimido',
        concentration: '10mg',
        price: 34.9,
        stock: 45,
        unit: 'cx',
        defaultDosage: '1 comprimido em jejum pela manhã por 10 dias',
        requiresPrescription: false,
        active: true
      },
      {
        id: 10,
        name: 'Shampoo Clorexiderm 200ml',
        activePrinciple: 'Digluconato de Clorexidina 2%',
        category: 'Dermatológico / Higiene Terapêutica',
        presentation: 'Shampoo',
        concentration: '200ml',
        price: 59.9,
        stock: 18,
        unit: 'frasco',
        defaultDosage: 'Banhos 2 vezes por semana, deixando agir por 10 minutos antes do enxágue',
        requiresPrescription: false,
        active: true
      }
    ]
  };
}

@Injectable()
export class DemoBackendInterceptor implements HttpInterceptor {

  private get isDemoMode(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    // Ativa quando hospedado no GitHub Pages (*.github.io) ou quando o protocolo é HTTPS sem backend remoto
    return host.includes('github.io') || (!host.includes('localhost') && !host.includes('127.0.0.1'));
  }

  private loadDb(): DbState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.dailyServices || !parsed.dailyServices.length) {
          parsed.dailyServices = getInitialDbState().dailyServices;
          this.saveDb(parsed);
        }
        if (!parsed.medications || !parsed.medications.length) {
          parsed.medications = getInitialDbState().medications;
          this.saveDb(parsed);
        }
        return parsed;
      }
    } catch { }
    const initial = getInitialDbState();
    this.saveDb(initial);
    return initial;
  }

  private saveDb(db: DbState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch { }
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isDemoMode) {
      return next.handle(req);
    }

    const url = req.url;
    // Intercepta qualquer rota da API
    if (!url.includes('/api/')) {
      return next.handle(req);
    }

    const path = url.substring(url.indexOf('/api/'));
    const method = req.method.toUpperCase();
    const db = this.loadDb();

    // 1. Auth Login: POST /api/auth/login
    if (path.startsWith('/api/auth/login') && method === 'POST') {
      const { email, password } = req.body || {};
      const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase().trim());
      if (user && user.password === password) {
        const token = user.token || ('token-' + Date.now());
        const responseUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          canManageProducts: !!user.canManageProducts,
          token
        };
        return of(new HttpResponse({ status: 200, body: responseUser })).pipe(delay(50));
      }
      return of(new HttpResponse({ status: 401, body: { error: 'Email ou senha inválidos' } })).pipe(delay(50));
    }

    // 2. Auth Register: POST /api/auth/register
    if (path.startsWith('/api/auth/register') && method === 'POST') {
      const { name, email, password } = req.body || {};
      const existing = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
      if (existing) {
        return of(new HttpResponse({ status: 409, body: { error: 'Email já cadastrado' } })).pipe(delay(50));
      }
      const newUser = {
        id: db.users.length + 1,
        name,
        email,
        password,
        role: 'customer',
        token: 'token-' + Date.now()
      };
      db.users.push(newUser);
      db.customers.push({
        id: db.customers.length + 1,
        name,
        email,
        phone: '',
        status: 'active',
        userId: newUser.id,
        pets: []
      });
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newUser })).pipe(delay(50));
    }

    // 3. Auth Logout: POST /api/auth/logout
    if (path.startsWith('/api/auth/logout') && method === 'POST') {
      return of(new HttpResponse({ status: 200, body: { ok: true } }));
    }

    // 4. Products: /api/products
    if (path === '/api/products' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.products })).pipe(delay(30));
    }
    if (path === '/api/products' && method === 'POST') {
      const newProd = { ...req.body, id: db.products.length ? Math.max(...db.products.map(p => p.id)) + 1 : 1 };
      db.products.push(newProd);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newProd })).pipe(delay(30));
    }
    if (path.startsWith('/api/products/') && method === 'PUT') {
      const id = +path.split('/')[3];
      db.products = db.products.map(p => p.id === id ? { ...p, ...req.body, id } : p);
      this.saveDb(db);
      const updated = db.products.find(p => p.id === id);
      return of(new HttpResponse({ status: 200, body: updated }));
    }
    if (path.startsWith('/api/products/') && method === 'DELETE') {
      const id = +path.split('/')[3];
      db.products = db.products.filter(p => p.id !== id);
      this.saveDb(db);
      return of(new HttpResponse({ status: 204, body: null }));
    }

    // 5. Services: /api/services
    if (path === '/api/services' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.services })).pipe(delay(30));
    }
    if (path === '/api/services' && method === 'POST') {
      const newSvc = { ...req.body, id: db.services.length ? Math.max(...db.services.map(s => s.id)) + 1 : 1 };
      db.services.push(newSvc);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newSvc }));
    }
    if (path.startsWith('/api/services/') && method === 'PUT') {
      const id = +path.split('/')[3];
      db.services = db.services.map(s => s.id === id ? { ...s, ...req.body, id } : s);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.services.find(s => s.id === id) }));
    }
    if (path.startsWith('/api/services/') && method === 'DELETE') {
      const id = +path.split('/')[3];
      db.services = db.services.filter(s => s.id !== id);
      this.saveDb(db);
      return of(new HttpResponse({ status: 204, body: null }));
    }

    // 6. Customers: /api/customers
    if (path === '/api/customers' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.customers })).pipe(delay(30));
    }
    if (path === '/api/customers' && method === 'POST') {
      const newCust = { ...req.body, id: db.customers.length + 1, pets: [] };
      db.customers.push(newCust);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newCust }));
    }
    if (path.startsWith('/api/customers/') && method === 'PUT') {
      const id = +path.split('/')[3];
      db.customers = db.customers.map(c => c.id === id ? { ...c, ...req.body, id } : c);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.customers.find(c => c.id === id) }));
    }

    // 7. Pets: /api/pets
    if (path === '/api/pets' && method === 'POST') {
      const newPet = { ...req.body, id: db.pets.length ? Math.max(...db.pets.map(p => p.id)) + 1 : 1 };
      db.pets.push(newPet);
      const cust = db.customers.find(c => c.id === newPet.customerId);
      if (cust) {
        cust.pets = cust.pets || [];
        cust.pets.push(newPet);
      }
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newPet }));
    }
    if (path.startsWith('/api/pets/') && method === 'PUT') {
      const id = +path.split('/')[3];
      db.pets = db.pets.map(p => p.id === id ? { ...p, ...req.body, id } : p);
      db.customers.forEach(c => {
        if (c.pets) c.pets = c.pets.map((p: any) => p.id === id ? { ...p, ...req.body, id } : p);
      });
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.pets.find(p => p.id === id) }));
    }
    if (path.startsWith('/api/pets/') && method === 'DELETE') {
      const id = +path.split('/')[3];
      db.pets = db.pets.filter(p => p.id !== id);
      db.customers.forEach(c => {
        if (c.pets) c.pets = c.pets.filter((p: any) => p.id !== id);
      });
      this.saveDb(db);
      return of(new HttpResponse({ status: 204, body: null }));
    }

    // 8. Appointments: /api/appointments
    if (path === '/api/appointments' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.appointments })).pipe(delay(30));
    }
    if (path === '/api/appointments' && method === 'POST') {
      const newAppt = {
        ...req.body,
        id: db.appointments.length ? Math.max(...db.appointments.map(a => a.id)) + 1 : 1,
        status: 'solicitado',
        userName: req.body.customerName || 'Admin Animal World',
        createdAt: new Date().toISOString()
      };
      db.appointments.push(newAppt);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newAppt })).pipe(delay(30));
    }
    if (path.includes('/status') && path.startsWith('/api/appointments/') && method === 'PATCH') {
      const id = +path.split('/')[3];
      const status = req.body?.status;
      db.appointments = db.appointments.map(a => a.id === id ? { ...a, status } : a);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.appointments.find(a => a.id === id) }));
    }

    // Check-in a partir de agendamento: POST /api/appointments/:id/checkin
    if (path.includes('/checkin') && path.startsWith('/api/appointments/') && method === 'POST') {
      const id = +path.split('/')[3];
      const appt = db.appointments.find(a => a.id === id);
      if (!appt) {
        return of(new HttpResponse({ status: 404, body: { error: 'Agendamento não encontrado' } }));
      }
      const today = new Date().toISOString().split('T')[0];
      const nextOrder = db.dailyServices.filter(d => d.date === today).length + 1;
      const isTosa = String(appt.serviceName || '').toLowerCase().includes('tosa');
      const newDs = {
        id: db.dailyServices.length ? Math.max(...db.dailyServices.map(d => d.id)) + 1 : 1,
        appointmentId: appt.id,
        customerId: appt.customerId || null,
        customerName: appt.customerName || appt.userName || 'Cliente',
        phone: appt.phone || '',
        petId: appt.petId || null,
        petName: appt.petName,
        petBreed: '',
        serviceId: appt.serviceId || null,
        serviceName: appt.serviceName || 'Serviço',
        date: today,
        queueOrder: nextOrder,
        status: 'aguardando',
        healthChecklist: {},
        notes: appt.notes || '',
        estimatedPrice: 79.9,
        finalPrice: null,
        cageNumber: '',
        groomerName: '',
        requiresValidation: isTosa,
        validationConfirmed: !isTosa,
        checkinAt: new Date().toISOString()
      };
      db.dailyServices.push(newDs);
      appt.status = 'confirmado';
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newDs })).pipe(delay(30));
    }

    // Daily Services: GET /api/daily-services
    if (path.startsWith('/api/daily-services') && method === 'GET') {
      const urlDateMatch = req.url.match(/date=([^&]+)/);
      const targetDate = urlDateMatch ? urlDateMatch[1] : new Date().toISOString().split('T')[0];
      const items = (db.dailyServices || []).filter(d => d.date === targetDate);
      const waiting = items.filter(i => i.status === 'aguardando').length;
      const inProgress = items.filter(i => i.status === 'em_atendimento').length;
      const ready = items.filter(i => i.status === 'pronto').length;
      const delivered = items.filter(i => i.status === 'entregue').length;
      const canceled = items.filter(i => i.status === 'cancelado').length;

      const d = new Date(targetDate + 'T12:00:00Z');
      const dayOfWeek = d.getUTCDay();
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const capacity = isSunday ? 0 : (isSaturday ? 32 : 50);
      const activeCount = items.length - canceled;

      return of(new HttpResponse({
        status: 200,
        body: {
          items,
          stats: {
            date: targetDate,
            capacity,
            totalToday: items.length,
            waiting,
            inProgress,
            ready,
            delivered,
            canceled,
            remainingSpots: isSunday ? 0 : Math.max(0, capacity - activeCount),
            isFull: isSunday || activeCount >= capacity,
            isClosed: isSunday
          }
        }
      })).pipe(delay(30));
    }

    // Daily Services: POST /api/daily-services
    if (path === '/api/daily-services' && method === 'POST') {
      const today = req.body.date || new Date().toISOString().split('T')[0];
      const d = new Date(today + 'T12:00:00Z');
      const dayOfWeek = d.getUTCDay();
      const isSunday = dayOfWeek === 0;
      if (isSunday) {
        return of(new HttpResponse({
          status: 400,
          body: { error: 'O pet shop está fechado aos domingos. Check-in na esteira não permitido.' }
        }));
      }

      const isSaturday = dayOfWeek === 6;
      const capacity = isSaturday ? 32 : 50;
      const activeCount = (db.dailyServices || []).filter(item => item.date === today && item.status !== 'cancelado').length;
      if (activeCount >= capacity) {
        return of(new HttpResponse({
          status: 400,
          body: { error: `Vagas do dia encerradas! Capacidade máxima de ${capacity} atendimentos já foi atingida.` }
        }));
      }

      const nextOrder = (db.dailyServices || []).filter(item => item.date === today).length + 1;
      const isTosa = String(req.body.serviceName || '').toLowerCase().includes('tosa');
      const newDs = {
        ...req.body,
        id: db.dailyServices.length ? Math.max(...db.dailyServices.map(item => item.id)) + 1 : 1,
        date: today,
        queueOrder: nextOrder,
        status: 'aguardando',
        requiresValidation: req.body.requiresValidation !== undefined ? req.body.requiresValidation : isTosa,
        validationConfirmed: req.body.validationConfirmed !== undefined ? req.body.validationConfirmed : !isTosa,
        checkinAt: new Date().toISOString()
      };
      db.dailyServices.push(newDs);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newDs })).pipe(delay(30));
    }

    // Daily Services: PATCH /api/daily-services/:id/status
    if (path.includes('/status') && path.startsWith('/api/daily-services/') && method === 'PATCH') {
      const id = +path.split('/')[3];
      const status = req.body?.status;
      const ds = (db.dailyServices || []).find(d => d.id === id);
      if (ds) {
        // HU-06: Bloqueio estrito — tosa NUNCA avança para pronto ou entregue sem confirmação humana
        if (['pronto', 'entregue'].includes(status) && ds.requiresValidation && !ds.validationConfirmed) {
          return of(new HttpResponse({
            status: 400,
            body: { error: 'Bloqueio de segurança: este procedimento de tosa requer validação humana confirmada com o tutor antes de ser concluído.' }
          }));
        }

        ds.status = status;
        if (status === 'em_atendimento' && !ds.startedAt) ds.startedAt = new Date().toISOString();
        if (status === 'pronto' && !ds.readyAt) ds.readyAt = new Date().toISOString();
        if (status === 'entregue' && !ds.deliveredAt) ds.deliveredAt = new Date().toISOString();
        if (status === 'entregue' && ds.appointmentId) {
          const appt = db.appointments.find(a => a.id === ds.appointmentId);
          if (appt) appt.status = 'concluido';
        }
        this.saveDb(db);
        return of(new HttpResponse({ status: 200, body: ds }));
      }
      return of(new HttpResponse({ status: 404, body: { error: 'Não encontrado' } }));
    }

    // Daily Services: PUT /api/daily-services/:id
    if (path.startsWith('/api/daily-services/') && method === 'PUT') {
      const id = +path.split('/')[3];
      const ds = (db.dailyServices || []).find(d => d.id === id);
      if (ds) {
        Object.assign(ds, req.body);
        if (req.body.validationConfirmed && !ds.validatedAt) {
          ds.validatedAt = new Date().toISOString();
        }
        this.saveDb(db);
        return of(new HttpResponse({ status: 200, body: ds }));
      }
      return of(new HttpResponse({ status: 404, body: { error: 'Não encontrado' } }));
    }

    // Daily Services: DELETE /api/daily-services/:id
    if (path.startsWith('/api/daily-services/') && method === 'DELETE') {
      const id = +path.split('/')[3];
      db.dailyServices = (db.dailyServices || []).filter(d => d.id !== id);
      this.saveDb(db);
      return of(new HttpResponse({ status: 204, body: null }));
    }

    // Medications: GET /api/medications
    if (path === '/api/medications' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.medications || [] })).pipe(delay(30));
    }
    // Medications: GET /api/medications/:id
    if (path.startsWith('/api/medications/') && method === 'GET') {
      const id = +path.split('/')[3];
      const med = (db.medications || []).find(m => m.id === id);
      return of(new HttpResponse({ status: med ? 200 : 404, body: med || { error: 'Medicamento não encontrado' } })).pipe(delay(30));
    }
    // Medications: POST /api/medications
    if (path === '/api/medications' && method === 'POST') {
      const nextId = (db.medications || []).length ? Math.max(...db.medications.map(m => m.id)) + 1 : 1;
      const newMed = {
        id: nextId,
        name: req.body.name,
        activePrinciple: req.body.activePrinciple || '',
        category: req.body.category || 'Outros',
        presentation: req.body.presentation || 'Comprimido',
        concentration: req.body.concentration || '',
        price: Number(req.body.price) || 0,
        stock: Number(req.body.stock) || 0,
        unit: req.body.unit || 'cx',
        defaultDosage: req.body.defaultDosage || '',
        requiresPrescription: !!req.body.requiresPrescription,
        active: req.body.active !== false,
        createdAt: new Date().toISOString()
      };
      db.medications = db.medications || [];
      db.medications.unshift(newMed);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newMed })).pipe(delay(30));
    }
    // Medications: PUT /api/medications/:id
    if (path.startsWith('/api/medications/') && method === 'PUT') {
      const id = +path.split('/')[3];
      const med = (db.medications || []).find(m => m.id === id);
      if (med) {
        Object.assign(med, req.body, { id, updatedAt: new Date().toISOString() });
        this.saveDb(db);
        return of(new HttpResponse({ status: 200, body: med })).pipe(delay(30));
      }
      return of(new HttpResponse({ status: 404, body: { error: 'Medicamento não encontrado' } }));
    }
    // Medications: DELETE /api/medications/:id
    if (path.startsWith('/api/medications/') && method === 'DELETE') {
      const id = +path.split('/')[3];
      db.medications = (db.medications || []).filter(m => m.id !== id);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: { success: true } })).pipe(delay(30));
    }

    // 9. Orders: /api/orders
    if (path === '/api/orders' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.orders })).pipe(delay(30));
    }
    if (path === '/api/orders' && method === 'POST') {
      const newOrder = {
        ...req.body,
        id: db.orders.length ? Math.max(...db.orders.map(o => o.id)) + 1 : 1,
        orderNumber: 'ORD-2026-' + String(db.orders.length + 1).padStart(4, '0'),
        status: 'pendente',
        createdAt: new Date().toISOString()
      };
      db.orders.push(newOrder);
      db.cash.push({
        id: db.cash.length + 1,
        type: 'entrada',
        description: `Venda de produtos #${newOrder.orderNumber}`,
        amount: newOrder.total,
        paymentMethod: newOrder.paymentMethod || 'pix',
        createdAt: new Date().toISOString()
      });
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newOrder })).pipe(delay(30));
    }
    if (path.includes('/status') && path.startsWith('/api/orders/') && method === 'PATCH') {
      const id = +path.split('/')[3];
      const status = req.body?.status;
      db.orders = db.orders.map(o => o.id === id ? { ...o, status } : o);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.orders.find(o => o.id === id) }));
    }

    // 10. Cash: /api/cash
    if (path === '/api/cash' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.cash })).pipe(delay(30));
    }
    if (path === '/api/cash' && method === 'POST') {
      const newMvt = { ...req.body, id: db.cash.length + 1, createdAt: new Date().toISOString() };
      db.cash.unshift(newMvt);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newMvt }));
    }

    // 11. Vets & Consultations
    if (path === '/api/vets' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.vets }));
    }
    if (path === '/api/consultations' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.consultations }));
    }
    if (path === '/api/consultations' && method === 'POST') {
      const newCons = {
        ...req.body,
        id: db.consultations.length ? Math.max(...db.consultations.map(c => c.id)) + 1 : 1,
        status: 'agendado',
        createdAt: new Date().toISOString()
      };
      db.consultations.unshift(newCons);
      this.saveDb(db);
      return of(new HttpResponse({ status: 201, body: newCons }));
    }
    if (path.startsWith('/api/consultations/') && method === 'PATCH') {
      const id = +path.split('/')[3];
      db.consultations = db.consultations.map(c => c.id === id ? { ...c, ...req.body } : c);
      this.saveDb(db);
      return of(new HttpResponse({ status: 200, body: db.consultations.find(c => c.id === id) }));
    }

    // 12. Coupons: /api/coupons
    if (path === '/api/coupons' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.coupons }));
    }
    if (path === '/api/coupons/validate' && method === 'POST') {
      const { code, total } = req.body || {};
      const coupon = db.coupons.find(c => c.code.toUpperCase() === (code || '').toUpperCase() && c.active);
      if (!coupon) {
        return of(new HttpResponse({ status: 200, body: { valid: false, message: 'Cupom inválido ou inativo' } }));
      }
      if (coupon.minOrderTotal && total < coupon.minOrderTotal) {
        return of(new HttpResponse({ status: 200, body: { valid: false, message: `Valor mínimo de R$ ${coupon.minOrderTotal.toFixed(2)}` } }));
      }
      const discount = coupon.discountType === 'percent' ? (total * coupon.discountValue) / 100 : coupon.discountValue;
      return of(new HttpResponse({
        status: 200,
        body: {
          valid: true,
          code: coupon.code,
          type: coupon.discountType,
          value: coupon.discountValue,
          discount,
          finalTotal: Math.max(0, total - discount),
          message: 'Cupom aplicado!'
        }
      }));
    }

    // 13. Reports: /api/reports
    if (path.startsWith('/api/reports') && method === 'GET') {
      const totalRevenue = db.orders.reduce((sum, o) => sum + (o.status !== 'cancelado' ? o.total : 0), 0);
      return of(new HttpResponse({
        status: 200,
        body: {
          from: '2026-01-01',
          to: '2026-12-31',
          ordersCount: db.orders.length,
          revenue: totalRevenue,
          byPaymentMethod: [
            { payment_method: 'pix', orders_count: db.orders.length, revenue: totalRevenue }
          ],
          ordersByStatus: [
            { status: 'pago', count: db.orders.filter(o => o.status === 'pago').length },
            { status: 'pendente', count: db.orders.filter(o => o.status === 'pendente').length }
          ],
          topProducts: db.products.slice(0, 5).map(p => ({ name: p.name, quantity: 10, revenue: p.price * 10 })),
          appointmentsByStatus: [
            { status: 'confirmado', count: db.appointments.filter(a => a.status === 'confirmado').length },
            { status: 'solicitado', count: db.appointments.filter(a => a.status === 'solicitado').length }
          ]
        }
      }));
    }

    // 14. Users: /api/users
    if (path === '/api/users' && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.users }));
    }

    // 15. Audit: /api/audit
    if (path.startsWith('/api/audit') && method === 'GET') {
      return of(new HttpResponse({ status: 200, body: db.audit }));
    }

    // 16. Me Export / Delete
    if (path === '/api/me/export' && method === 'GET') {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      return of(new HttpResponse({ status: 200, body: blob }));
    }
    if (path === '/api/me' && method === 'DELETE') {
      return of(new HttpResponse({ status: 200, body: { ok: true } }));
    }

    // Default fallback para rotas não mapeadas
    return of(new HttpResponse({ status: 200, body: {} }));
  }
}
