import { Component, Input } from '@angular/core';
import { Service } from 'src/app/shared/models/service.model';

@Component({
  selector: 'app-service-list',
  templateUrl: './service-list.component.html',
  styleUrls: ['./service-list.component.scss']
})
export class ServiceListComponent {
  @Input() services: Service[] = [];

  trackByServiceId(index: number, service: Service): number {
    return service.id ?? index;
  }
}
