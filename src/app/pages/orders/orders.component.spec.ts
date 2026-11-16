import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { OrdersComponent } from './orders.component';
import { OrderService } from '../../shared/services/order.service';
import { AuthService, User } from '../../shared/services/auth.service';
import { AuditService } from '../../shared/services/audit.service';
import { Order } from '../../shared/models/order.model';

describe('OrdersComponent', () => {
  let fixture: ComponentFixture<OrdersComponent>;
  let component: OrdersComponent;
  let ordersSubject: BehaviorSubject<Order[]>;
  let orderServiceSpy: jasmine.SpyObj<OrderService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const order: Order = {
    id: 1,
    orderNumber: 'PED-1',
    customerName: 'Maria',
    items: [{ name: 'Ração', price: 50, quantity: 1 }],
    total: 50,
    status: 'pendente',
    createdAt: '2026-01-01T10:00:00.000Z',
    userId: 7
  };

  function setup(user: User | null) {
    ordersSubject = new BehaviorSubject<Order[]>([order]);
    orderServiceSpy = jasmine.createSpyObj('OrderService', ['getOrders', 'updateStatus']);
    orderServiceSpy.getOrders.and.returnValue(ordersSubject.asObservable());
    orderServiceSpy.updateStatus.and.returnValue(of(order));
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    authServiceSpy.getCurrentUser.and.returnValue(user);
    const auditServiceSpy = jasmine.createSpyObj('AuditService', ['list']);

    TestBed.configureTestingModule({
      declarations: [OrdersComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AuditService, useValue: auditServiceSpy }
      ]
    });

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('customer vê apenas os próprios pedidos', () => {
    setup({ id: 7, name: 'Maria', email: 'm@m.com', role: 'customer' });
    expect(component.orders.length).toBe(1);
    expect(component.isStaff).toBeFalse();

    ordersSubject.next([order, { ...order, id: 2, userId: 99 }]);
    expect(component.orders.length).toBe(1);
  });

  it('staff vê todos os pedidos e isStaff=true', () => {
    setup({ id: 1, name: 'Admin', email: 'a@a.com', role: 'admin' });
    ordersSubject.next([order, { ...order, id: 2, userId: 99 }]);
    expect(component.orders.length).toBe(2);
    expect(component.isStaff).toBeTrue();
  });

  it('setStatus chama updateStatus do service', () => {
    setup({ id: 1, name: 'Admin', email: 'a@a.com', role: 'admin' });
    const event = { target: { value: 'pago' } } as unknown as Event;
    component.setStatus(order, event);
    expect(orderServiceSpy.updateStatus).toHaveBeenCalledWith(1, 'pago');
  });

  it('setStatus não chama service quando status igual', () => {
    setup({ id: 1, name: 'Admin', email: 'a@a.com', role: 'admin' });
    const event = { target: { value: 'pendente' } } as unknown as Event;
    component.setStatus(order, event);
    expect(orderServiceSpy.updateStatus).not.toHaveBeenCalled();
  });
});
