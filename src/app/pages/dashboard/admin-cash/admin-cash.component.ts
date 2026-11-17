import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CashService, CashMovement } from '../../../shared/services/cash.service';
import { ProductService } from '../../../shared/services/product.service';
import { Product } from '../../../shared/models/product.model';
import { PayableService } from '../../../shared/services/payable.service';
import { Payable, PayableCategory, PayableStatus } from '../../../shared/models/payable.model';
import { DailyServicesService } from '../../../shared/services/daily-services.service';
import { DailyService } from '../../../shared/models/daily-service.model';
import { GroomerService } from '../../../shared/services/groomer.service';

export interface PdvCartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export interface PdvSaleReceipt {
  id: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
}

@Component({
  selector: 'app-admin-cash',
  templateUrl: './admin-cash.component.html',
  styleUrls: ['./admin-cash.component.scss']
})
export class AdminCashComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Abas operacionais (HU-22, HU-23, HU-24)
  activeTab: 'pdv' | 'movements' | 'payables' | 'closure' = 'pdv';

  // --- 1. Fluxo de Caixa Geral ---
  movements: CashMovement[] = [];
  showForm = false;
  movementForm: FormGroup;
  originSource: string | null = null;
  originDetails: { petName?: string; customerName?: string; serviceName?: string } = {};

  // --- 2. PDV de Balcão Rápido (HU-22) ---
  products: Product[] = [];
  filteredPdvProducts: Product[] = [];
  pdvSearch = '';
  pdvCart: PdvCartItem[] = [];
  pdvCustomerName = 'Cliente Balcão';
  pdvCustomerPhone = '';
  pdvPaymentMethod: 'pix' | 'dinheiro' | 'cartao_debito' | 'cartao_credito' = 'pix';
  pdvCashReceived = 0;
  pdvDiscount = 0;
  pdvReceiptModal = false;
  lastSaleReceipt: PdvSaleReceipt | null = null;
  pdvSuccessMsg = '';

  // --- 3. Contas a Pagar como Fluxo (HU-23) ---
  payables: Payable[] = [];
  payableFilter: 'todos' | 'previsto' | 'pago' = 'todos';
  payableCategoryFilter: string = 'todas';
  showPayableModal = false;
  showPayModal = false;
  payableToPay: Payable | null = null;
  payablePaymentMethod = 'pix';
  payableForm: FormGroup;

  // --- 4. Fechamento Consolidado do Dia (HU-24) ---
  closureDate: string = new Date().toISOString().split('T')[0];
  dailyQueueItems: DailyService[] = [];

  constructor(
    private fb: FormBuilder,
    private cashService: CashService,
    private productService: ProductService,
    private payableService: PayableService,
    private dailyService: DailyServicesService,
    private groomerService: GroomerService,
    private route: ActivatedRoute
  ) {
    this.movementForm = this.fb.group({
      type: ['entrada', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['pix']
    });

    this.payableForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      dueDate: [new Date().toISOString().split('T')[0], Validators.required],
      category: ['fornecedor', Validators.required],
      supplier: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // 1. Lançamentos de caixa
    this.cashService.list().pipe(takeUntil(this.destroy$)).subscribe(m => this.movements = m);

    // 2. Produtos para PDV
    this.productService.getProducts().pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.products = p || [];
      this.filterPdvProducts();
    });

    // 3. Contas a pagar
    this.payableService.getPayables().pipe(takeUntil(this.destroy$)).subscribe(pay => {
      this.payables = pay || [];
    });

    // 4. Esteira para fechamento
    this.dailyService.queue$.pipe(takeUntil(this.destroy$)).subscribe(q => {
      this.dailyQueueItems = q.items || [];
    });

    // Encaminhamento da Esteira de Delivery
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params.amount || params.description) {
        this.activeTab = 'movements';
        this.originSource = params.source || null;
        this.originDetails = {
          petName: params.petName || '',
          customerName: params.customerName || '',
          serviceName: params.serviceName || ''
        };
        this.movementForm.patchValue({
          type: 'entrada',
          description: params.description || `Atendimento — Pet ${params.petName || ''} (${params.customerName || ''})`,
          amount: Number(params.amount) || 0,
          paymentMethod: params.paymentMethod || 'pix'
        });
        this.showForm = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================
  // ABA 1: PDV DE BALCÃO RÁPIDO (HU-22)
  // =========================================================
  filterPdvProducts(): void {
    const q = this.pdvSearch.toLowerCase().trim();
    if (!q) {
      this.filteredPdvProducts = [...this.products];
    } else {
      this.filteredPdvProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.includes(q))
      );
    }
  }

  addToPdvCart(product: Product): void {
    if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
      alert(`O produto "${product.name}" está esgotado (saldo 0). Não é possível adicionar.`);
      return;
    }

    const existing = this.pdvCart.find(item => item.product.id === product.id);
    if (existing) {
      const maxAvailable = product.stock !== null && product.stock !== undefined ? product.stock : 999;
      if (existing.quantity >= maxAvailable) {
        alert(`Estoque máximo atingido para ${product.name} (${maxAvailable} un.)`);
        return;
      }
      existing.quantity += 1;
    } else {
      this.pdvCart.push({
        product,
        quantity: 1,
        unitPrice: product.price
      });
    }
  }

  updatePdvQty(index: number, delta: number): void {
    const item = this.pdvCart[index];
    if (!item) return;

    const maxAvailable = item.product.stock !== null && item.product.stock !== undefined ? item.product.stock : 999;
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      this.removeFromPdvCart(index);
    } else if (newQty > maxAvailable) {
      alert(`Quantidade solicitada excede estoque disponível (${maxAvailable} un.)`);
    } else {
      item.quantity = newQty;
    }
  }

  removeFromPdvCart(index: number): void {
    this.pdvCart.splice(index, 1);
  }

  clearPdvCart(): void {
    this.pdvCart = [];
    this.pdvDiscount = 0;
    this.pdvCashReceived = 0;
    this.pdvCustomerName = 'Cliente Balcão';
    this.pdvCustomerPhone = '';
  }

  get pdvSubtotal(): number {
    return this.pdvCart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  get pdvTotal(): number {
    const total = this.pdvSubtotal - (Number(this.pdvDiscount) || 0);
    return Math.max(0, total);
  }

  get pdvChange(): number {
    if (this.pdvPaymentMethod !== 'dinheiro') return 0;
    const received = Number(this.pdvCashReceived) || 0;
    return Math.max(0, received - this.pdvTotal);
  }

  finalizePdvSale(): void {
    if (this.pdvCart.length === 0) return;

    if (this.pdvPaymentMethod === 'dinheiro') {
      const rec = Number(this.pdvCashReceived) || 0;
      if (rec < this.pdvTotal) {
        alert(`Valor em dinheiro recebido (R$ ${this.formatPrice(rec)}) é menor que o total da venda (R$ ${this.formatPrice(this.pdvTotal)}).`);
        return;
      }
    }

    const itemsSummary = this.pdvCart.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
    const desc = `Venda PDV Balcão [${this.pdvCustomerName}] — ${itemsSummary}`;

    // 1. Registra no Caixa
    this.cashService.register({
      type: 'entrada',
      amount: this.pdvTotal,
      description: desc,
      paymentMethod: this.pdvPaymentMethod
    }).pipe(takeUntil(this.destroy$)).subscribe();

    // 2. Dá baixa física de estoque nos produtos vendidos
    for (const item of this.pdvCart) {
      if (item.product.stock !== null && item.product.stock !== undefined) {
        const remaining = Math.max(0, item.product.stock - item.quantity);
        this.productService.restock(item.product.id, remaining, 'adjust', undefined, undefined, `Baixa PDV Balcão #${Date.now()}`)
          .pipe(takeUntil(this.destroy$)).subscribe();
      }
    }

    // 3. Monta o cupom fiscal simplificado de balcão
    this.lastSaleReceipt = {
      id: 'PDV-' + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toLocaleString('pt-BR'),
      customerName: this.pdvCustomerName || 'Cliente Balcão',
      customerPhone: this.pdvCustomerPhone,
      items: this.pdvCart.map(i => ({
        name: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.quantity * i.unitPrice
      })),
      subtotal: this.pdvSubtotal,
      discount: this.pdvDiscount,
      total: this.pdvTotal,
      paymentMethod: this.getPaymentMethodLabel(this.pdvPaymentMethod),
      cashReceived: this.pdvPaymentMethod === 'dinheiro' ? this.pdvCashReceived : undefined,
      change: this.pdvPaymentMethod === 'dinheiro' ? this.pdvChange : undefined
    };

    this.pdvReceiptModal = true;
    this.clearPdvCart();
  }

  closeReceiptModal(): void {
    this.pdvReceiptModal = false;
    this.lastSaleReceipt = null;
  }

  printReceipt(): void {
    window.print();
  }

  // =========================================================
  // ABA 2: LANÇAMENTOS E FLUXO DE CAIXA
  // =========================================================
  get balance(): number {
    return this.movements.reduce(
      (sum, m) => sum + (m.type === 'entrada' ? m.amount : -m.amount), 0
    );
  }

  openCreate(): void {
    this.originSource = null;
    this.originDetails = {};
    this.movementForm.reset({ type: 'entrada', description: '', amount: 0, paymentMethod: 'pix' });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.originSource = null;
    this.originDetails = {};
  }

  save(): void {
    if (this.movementForm.invalid) return;
    const v = this.movementForm.value;
    this.cashService.register({
      type: v.type,
      description: v.description,
      amount: Number(v.amount),
      paymentMethod: v.paymentMethod || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showForm = false;
      this.originSource = null;
      this.originDetails = {};
    });
  }

  // =========================================================
  // ABA 3: CONTAS A PAGAR (HU-23)
  // =========================================================
  get filteredPayables(): Payable[] {
    return this.payables.filter(p => {
      if (this.payableFilter !== 'todos' && p.status !== this.payableFilter) return false;
      if (this.payableCategoryFilter !== 'todas' && p.category !== this.payableCategoryFilter) return false;
      return true;
    });
  }

  get totalPayablesDue(): number {
    return this.payables
      .filter(p => p.status === 'previsto')
      .reduce((acc, p) => acc + p.amount, 0);
  }

  get totalPayablesPaid(): number {
    return this.payables
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + p.amount, 0);
  }

  get overduePayablesCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.payables.filter(p => p.status === 'previsto' && p.dueDate < today).length;
  }

  isPayableOverdue(p: Payable): boolean {
    if (p.status !== 'previsto') return false;
    const today = new Date().toISOString().split('T')[0];
    return p.dueDate < today;
  }

  openNewPayableModal(): void {
    this.payableForm.reset({
      description: '',
      amount: 0,
      dueDate: new Date().toISOString().split('T')[0],
      category: 'fornecedor',
      supplier: '',
      notes: ''
    });
    this.showPayableModal = true;
  }

  closePayableModal(): void {
    this.showPayableModal = false;
  }

  saveNewPayable(): void {
    if (this.payableForm.invalid) return;
    const val = this.payableForm.value;

    this.payableService.createPayable({
      description: val.description,
      amount: Number(val.amount),
      dueDate: val.dueDate,
      category: val.category as PayableCategory,
      supplier: val.supplier || undefined,
      notes: val.notes || undefined,
      status: 'previsto'
    }).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.closePayableModal();
    });
  }

  openPayModal(payable: Payable): void {
    this.payableToPay = payable;
    this.payablePaymentMethod = 'pix';
    this.showPayModal = true;
  }

  closePayModal(): void {
    this.showPayModal = false;
    this.payableToPay = null;
  }

  confirmPayment(): void {
    if (!this.payableToPay) return;

    this.payableService.markAsPaid(this.payableToPay.id, this.payablePaymentMethod)
      .pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.closePayModal();
      });
  }

  deletePayable(p: Payable): void {
    if (confirm(`Excluir conta a pagar "${p.description}"?`)) {
      this.payableService.deletePayable(p.id).pipe(takeUntil(this.destroy$)).subscribe();
    }
  }

  // =========================================================
  // ABA 4: FECHAMENTO CONSOLIDADO DO DIA (HU-24)
  // =========================================================
  get closureServicesCount(): number {
    return this.dailyQueueItems.filter(i => i.date === this.closureDate && i.status !== 'cancelado').length;
  }

  get closureServicesTotal(): number {
    return this.dailyQueueItems
      .filter(i => i.date === this.closureDate && i.status !== 'cancelado')
      .reduce((acc, i) => acc + (Number(i.finalPrice || i.estimatedPrice || 0) - Number(i.taxiPrice || 0)), 0);
  }

  get closureTaxiTotal(): number {
    return this.dailyQueueItems
      .filter(i => i.date === this.closureDate && i.status !== 'cancelado')
      .reduce((acc, i) => acc + Number(i.taxiPrice || 0), 0);
  }

  get closureCommissionsTotal(): number {
    const daily = this.dailyQueueItems.filter(i => i.date === this.closureDate);
    const reps = this.groomerService.calculateCommissions(daily, this.closureDate, this.closureDate);
    return reps.reduce((acc, r) => acc + r.totalCommissionDue, 0);
  }

  get closureMovementsForDay(): CashMovement[] {
    return this.movements.filter(m => {
      const mDate = m.createdAt.split('T')[0];
      return mDate === this.closureDate;
    });
  }

  get closureInflows(): number {
    return this.closureMovementsForDay
      .filter(m => m.type === 'entrada')
      .reduce((acc, m) => acc + m.amount, 0);
  }

  get closureOutflows(): number {
    return this.closureMovementsForDay
      .filter(m => m.type === 'saida')
      .reduce((acc, m) => acc + m.amount, 0);
  }

  get closureNetResult(): number {
    return this.closureInflows - this.closureOutflows;
  }

  get closureMethodBreakdown(): { method: string; count: number; total: number }[] {
    const methods = ['pix', 'dinheiro', 'cartao_debito', 'cartao_credito'];
    return methods.map(met => {
      const matched = this.closureMovementsForDay.filter(m => m.type === 'entrada' && (m.paymentMethod || '').toLowerCase() === met);
      const total = matched.reduce((acc, m) => acc + m.amount, 0);
      return {
        method: this.getPaymentMethodLabel(met),
        count: matched.length,
        total
      };
    });
  }

  printClosureReport(): void {
    window.print();
  }

  // --- Helpers de Formatação ---
  getPaymentMethodLabel(method: string): string {
    switch ((method || '').toLowerCase()) {
      case 'pix': return 'Pix';
      case 'dinheiro': return 'Dinheiro em Espécie';
      case 'cartao_debito': return 'Cartão de Débito';
      case 'cartao_credito': return 'Cartão de Crédito';
      default: return method || 'Outro';
    }
  }

  formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return '0,00';
    return value.toFixed(2).replace('.', ',');
  }

  formatDate(value: string): string {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR');
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
}
