import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Service } from 'src/app/shared/models/service.model';

@Component({
  selector: 'app-service-card',
  templateUrl: './service-card.component.html',
  styleUrls: ['./service-card.component.scss']
})
export class ServiceCardComponent implements OnInit {
  @Input() service!: Service;

  constructor(private router: Router) { }

  ngOnInit(): void {
  }

  bookService(): void {
    this.router.navigate(['/appointments'], { queryParams: { serviceId: this.service.id } });
  }
}
