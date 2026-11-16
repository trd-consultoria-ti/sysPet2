import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { Order } from '../models/order.model';
import { environment } from '../../../environments/environment';

describe('OrderService', () => {
  let service: OrderService;
  let http: HttpTestingController;

  const baseOrder: Order = {
    id: 1,
    orderNumber: 'PED-1',
    customerName: 'Maria',
    items: [],
    total: 50,
    status: 'pendente',
    createdAt: '2026-01-01T10:00:00.000Z',
    userId: 1
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(OrderService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.apiUrl}/orders`).flush([baseOrder]);
  });

  afterEach(() => {
    http.verify();
  });

  it('getOrders emite pedidos carregados', () => {
    let orders: Order[] = [];
    service.getOrders().subscribe(o => orders = o);
    expect(orders.length).toBe(1);
    expect(orders[0].orderNumber).toBe('PED-1');
  });

  it('create posta pedido e adiciona no início da lista', () => {
    const created = { ...baseOrder, id: 2, orderNumber: 'PED-2' };
    service.create({ customerName: 'Maria', items: [] }).subscribe(order => {
      expect(order.id).toBe(2);
    });

    const req = http.expectOne(`${environment.apiUrl}/orders`);
    expect(req.request.method).toBe('POST');
    req.flush(created);

    let orders: Order[] = [];
    service.getOrders().subscribe(o => orders = o);
    expect(orders[0].id).toBe(2);
    expect(orders.length).toBe(2);
  });

  it('updateStatus chama PATCH e atualiza item na lista', () => {
    const updated = { ...baseOrder, status: 'pago' as const };
    service.updateStatus(1, 'pago').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/orders/1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.status).toBe('pago');
    req.flush(updated);

    let orders: Order[] = [];
    service.getOrders().subscribe(o => orders = o);
    expect(orders[0].status).toBe('pago');
  });
});
