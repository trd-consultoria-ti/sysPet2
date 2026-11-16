import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ServiceCatalogService } from 'src/app/shared/services/service-catalog.service';

export interface HomeServiceItem {
  id: number;
  title: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-services',
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.scss']
})
export class ServicesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  services: HomeServiceItem[] = [
    {
      id: 1,
      title: 'Banho Completo',
      description: 'Serviços profissionais de estética para manter seu pet bonito e se sentindo bem.',
      image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1471&q=80',
    },
    {
      id: 2,
      title: 'Taxi Dog',
      description: 'Transporte conveniente para seu pet ir e voltar de consultas, creche, ou qualquer lugar que precisem ir.',
      image: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1586&q=80',
    },
    {
      id: 3,
      title: 'Consulta Veterinária',
      description: 'Consultas veterinárias regulares para garantir a saúde e o bem-estar do seu pet.',
      image: 'https://images.unsplash.com/photo-1603123853880-a92fafb7809f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1587&q=80',
    },
    {
      id: 4,
      title: 'Adestramento Básico',
      description: 'Programas eficazes de treinamento para ajudar seu pet a desenvolver bom comportamento e habilidades sociais.',
      image: 'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    }
  ];

  constructor(
    private router: Router,
    private serviceCatalog: ServiceCatalogService
  ) { }

  ngOnInit(): void {
    this.serviceCatalog.getServices().pipe(takeUntil(this.destroy$)).subscribe(catalog => {
      if (catalog && catalog.length > 0) {
        this.services = catalog.slice(0, 4).map(s => ({
          id: s.id,
          title: s.name,
          description: s.description,
          image: s.image
        }));
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToServices(): void {
    this.router.navigate(['/services']);
  }
}
