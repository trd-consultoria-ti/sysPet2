import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ServiceCatalogService } from '../../../shared/services/service-catalog.service';
import { Service } from '../../../shared/models/service.model';

@Component({
  selector: 'app-admin-services',
  templateUrl: './admin-services.component.html',
  styleUrls: ['./admin-services.component.scss']
})
export class AdminServicesComponent implements OnInit {
  services: Service[] = [];
  showForm = false;
  editingId: number | null = null;
  serviceForm: FormGroup;

  constructor(private fb: FormBuilder, private catalogService: ServiceCatalogService) {
    this.serviceForm = this.fb.group({
      name: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      category: [''],
      duration: [''],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.catalogService.getServices().subscribe(s => this.services = s);
  }

  openCreate(): void {
    this.editingId = null;
    this.serviceForm.reset({ name: '', price: 0, category: '', duration: '', description: '' });
    this.showForm = true;
  }

  startEdit(service: Service): void {
    this.editingId = service.id || null;
    this.serviceForm.patchValue({
      name: service.name,
      price: service.price,
      category: service.category,
      duration: service.duration,
      description: service.description
    });
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editingId = null;
  }

  save(): void {
    if (this.serviceForm.invalid) return;
    const value = this.serviceForm.value;
    const payload: Omit<Service, 'id'> = {
      name: value.name,
      price: Number(value.price),
      rating: 0,
      reviews: 0,
      image: '',
      category: value.category || '',
      duration: value.duration || '',
      description: value.description || ''
    };

    const request$ = this.editingId
      ? this.catalogService.update({ ...payload, id: this.editingId } as Service)
      : this.catalogService.create(payload);

    request$.subscribe(() => {
      this.showForm = false;
      this.editingId = null;
    });
  }

  remove(service: Service): void {
    if (!service.id) return;
    if (confirm(`Excluir o serviço "${service.name}"?`)) {
      this.catalogService.delete(service.id).subscribe();
    }
  }

  formatPrice(price: number): string {
    return price.toFixed(2).replace('.', ',');
  }
}
