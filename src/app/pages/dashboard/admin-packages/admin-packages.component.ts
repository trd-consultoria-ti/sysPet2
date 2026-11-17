import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PetPackage, PackagePreset, PACKAGE_PRESETS } from '../../../shared/models/package.model';
import { PackageService } from '../../../shared/services/package.service';
import { CustomerService } from '../../../shared/services/customer.service';

@Component({
  selector: 'app-admin-packages',
  templateUrl: './admin-packages.component.html',
  styleUrls: ['./admin-packages.component.scss']
})
export class AdminPackagesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'active' | 'sell' = 'active';

  packages: PetPackage[] = [];
  presets: PackagePreset[] = PACKAGE_PRESETS;
  sellForm: FormGroup;
  toastMessage = '';
  toastType: 'success' | 'info' | 'warning' = 'info';

  search = '';

  constructor(
    private packageService: PackageService,
    private customerService: CustomerService,
    private fb: FormBuilder
  ) {
    const today = new Date();
    const expiry = new Date(today.getTime() + 1000 * 60 * 60 * 24 * 35);

    this.sellForm = this.fb.group({
      presetId: ['pkg-4b-1t', Validators.required],
      petName: ['', Validators.required],
      customerName: ['', Validators.required],
      customerPhone: [''],
      packageName: ['Plano Mensal Clássico (4 Banhos + 1 Tosa Higiênica)', Validators.required],
      totalBaths: [4, [Validators.required, Validators.min(1)]],
      totalGrooms: [1, [Validators.required, Validators.min(0)]],
      price: [190.00, [Validators.required, Validators.min(0)]],
      expirationDate: [expiry.toISOString().split('T')[0], Validators.required],
      paymentMethod: ['pix'],
      registerInCash: [true],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.packageService.getPackages().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.packages = list || [];
    });

    this.sellForm.get('presetId')?.valueChanges.subscribe(presetId => {
      const p = this.presets.find(x => x.id === presetId);
      if (p) {
        const today = new Date();
        const expiry = new Date(today.getTime() + 1000 * 60 * 60 * 24 * p.validityDays);
        this.sellForm.patchValue({
          packageName: p.name,
          totalBaths: p.baths,
          totalGrooms: p.grooms,
          price: p.price,
          expirationDate: expiry.toISOString().split('T')[0]
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredPackages(): PetPackage[] {
    if (!this.search.trim()) return this.packages;
    const q = this.search.toLowerCase().trim();
    return this.packages.filter(p =>
      p.petName.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.packageName.toLowerCase().includes(q)
    );
  }

  get activePackagesCount(): number {
    return this.packages.filter(p => p.status === 'ativo').length;
  }

  get totalRecurringRevenue(): number {
    return this.packages
      .filter(p => p.status === 'ativo')
      .reduce((acc, p) => acc + p.price, 0);
  }

  get totalAvailableBaths(): number {
    return this.packages
      .filter(p => p.status === 'ativo')
      .reduce((acc, p) => acc + Math.max(0, p.totalBaths - p.usedBaths), 0);
  }

  consumeCredit(pkg: PetPackage, type: 'bath' | 'groom'): void {
    const label = type === 'bath' ? '1 banho' : '1 tosa';
    if (!confirm(`Confirmar o consumo de ${label} do pacote de ${pkg.petName}?`)) {
      return;
    }

    this.packageService.consumeCredit(pkg.id, type).pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (res) {
        this.showToast(`Crédito de ${label} debitado com sucesso!`, 'success');
      } else {
        this.showToast(`Não há créditos de ${label} disponíveis neste pacote.`, 'warning');
      }
    });
  }

  submitSell(): void {
    if (this.sellForm.invalid) {
      this.sellForm.markAllAsTouched();
      return;
    }

    const val = this.sellForm.value;
    const today = new Date().toISOString().split('T')[0];

    this.packageService.createPackage({
      petName: val.petName,
      customerName: val.customerName,
      customerPhone: val.customerPhone || '',
      packageName: val.packageName,
      totalBaths: Number(val.totalBaths),
      usedBaths: 0,
      totalGrooms: Number(val.totalGrooms),
      usedGrooms: 0,
      price: Number(val.price),
      purchaseDate: today,
      expirationDate: val.expirationDate,
      status: 'ativo',
      notes: val.notes || ''
    }, !!val.registerInCash, val.paymentMethod).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.showToast(`Pacote ativado com sucesso para ${val.petName}!`, 'success');
      this.activeTab = 'active';
      this.sellForm.reset({
        presetId: 'pkg-4b-1t',
        petName: '',
        customerName: '',
        customerPhone: '',
        packageName: 'Plano Mensal Clássico (4 Banhos + 1 Tosa Higiênica)',
        totalBaths: 4,
        totalGrooms: 1,
        price: 190.00,
        expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35).toISOString().split('T')[0],
        paymentMethod: 'pix',
        registerInCash: true,
        notes: ''
      });
    });
  }

  deletePackage(pkg: PetPackage): void {
    if (confirm(`Remover pacote de ${pkg.petName}?`)) {
      this.packageService.deletePackage(pkg.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
        this.showToast('Pacote removido.', 'info');
      });
    }
  }

  isExpiringSoon(expirationDate: string): boolean {
    if (!expirationDate) return false;
    const today = new Date();
    const expiry = new Date(expirationDate);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }

  isExpired(expirationDate: string): boolean {
    if (!expirationDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return expirationDate < today;
  }

  formatPrice(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    return val.toFixed(2).replace('.', ',');
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }

  showToast(msg: string, type: 'success' | 'info' | 'warning' = 'info'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => this.toastMessage = '', 3500);
  }
}
