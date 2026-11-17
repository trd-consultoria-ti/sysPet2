import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PricingService, BusinessDayConfig } from '../../../shared/services/pricing.service';
import { BusinessProfileService } from '../../../shared/services/business-profile.service';
import { BusinessProfile } from '../../../shared/models/business-profile.model';

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss']
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'profile' | 'hours' = 'profile';

  // Perfil da Empresa (HU-30)
  profileForm: FormGroup;
  profileSaving = false;
  profileSuccess = '';

  // Horários e Capacidade (HU-26)
  businessDays: BusinessDayConfig[] = [];
  hoursSaving = false;
  hoursSuccess = '';

  constructor(
    private fb: FormBuilder,
    private businessProfileService: BusinessProfileService,
    private pricingService: PricingService
  ) {
    this.profileForm = this.fb.group({
      tradeName: ['', Validators.required],
      legalName: ['', Validators.required],
      cnpj: ['', Validators.required],
      ie: [''],
      addressLine: ['', Validators.required],
      city: ['', Validators.required],
      uf: ['DF', [Validators.required, Validators.maxLength(2)]],
      cep: ['', Validators.required],
      phone: ['', Validators.required],
      whatsapp: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      instagram: [''],
      website: ['']
    });
  }

  ngOnInit(): void {
    // 1. Carrega Perfil da Empresa
    this.businessProfileService.getProfile().pipe(takeUntil(this.destroy$)).subscribe(profile => {
      if (profile) {
        this.profileForm.patchValue(profile);
      }
    });

    // 2. Carrega Horários e Capacidade
    this.businessDays = this.pricingService.getBusinessHours();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Perfil da Empresa (HU-30) ---
  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSaving = true;
    const val: BusinessProfile = this.profileForm.value;

    this.businessProfileService.updateProfile(val).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.profileSaving = false;
        this.profileSuccess = 'Dados da empresa atualizados com sucesso!';
        setTimeout(() => this.profileSuccess = '', 3500);
      },
      error: () => {
        this.profileSaving = false;
        alert('Erro ao salvar dados da empresa.');
      }
    });
  }

  // --- Horários e Capacidade (HU-26) ---
  toggleDayOpen(index: number): void {
    this.businessDays[index].isOpen = !this.businessDays[index].isOpen;
    if (!this.businessDays[index].isOpen) {
      this.businessDays[index].capacity = 0;
    } else if (this.businessDays[index].capacity === 0) {
      this.businessDays[index].capacity = this.businessDays[index].dayOfWeek === 6 ? 32 : 50;
    }
  }

  saveBusinessHours(): void {
    this.hoursSaving = true;
    this.pricingService.saveBusinessHours(this.businessDays);

    setTimeout(() => {
      this.hoursSaving = false;
      this.hoursSuccess = 'Horários e capacidades por dia da semana salvos com sucesso!';
      setTimeout(() => this.hoursSuccess = '', 3500);
    }, 300);
  }
}
