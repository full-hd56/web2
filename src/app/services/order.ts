import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Order,
  OrderStatus,
  OrderStats,
  CreateOrderDto,
  UpdateOrderDto,
  RoutingTriggerResult,
  ApiResponse,
} from '../models/order';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly baseUrl = 'https://back-n-web2.vercel.app';

  private get rootUrl(): string {
    const clean = this.baseUrl.replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }
  private get ordersUrl(): string {
    return `${this.rootUrl}/orders`;
  }

  constructor(private http: HttpClient) { }

  getOrders(status?: OrderStatus | 'ALL', search?: string): Observable<Order[]> {
    let params = new HttpParams();
    if (status && status !== 'ALL') params = params.set('status', status);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<ApiResponse<Order[]>>(this.ordersUrl, { params }).pipe(map((res) => res.data));
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<ApiResponse<Order>>(`${this.ordersUrl}/${id}`).pipe(map((res) => res.data));
  }

  getStats(): Observable<OrderStats> {
    return this.http.get<ApiResponse<OrderStats>>(`${this.ordersUrl}/stats`).pipe(map((res) => res.data));
  }

  createOrder(dto: CreateOrderDto): Observable<Order> {
    return this.http.post<ApiResponse<Order>>(this.ordersUrl, dto).pipe(map((res) => res.data));
  }

  updateOrder(id: string, dto: UpdateOrderDto): Observable<Order> {
    return this.http.put<ApiResponse<Order>>(`${this.ordersUrl}/${id}`, dto).pipe(map((res) => res.data));
  }

  cancelOrder(id: string): Observable<Order> {
    return this.http.patch<ApiResponse<Order>>(`${this.ordersUrl}/${id}/cancel`, {}).pipe(map((res) => res.data));
  }

  deleteOrder(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.ordersUrl}/${id}`).pipe(map(() => undefined));
  }

  generateMockup(count?: number): Observable<{ count: number; orders: Order[] }> {
    return this.http.post<ApiResponse<Order[]>>(`${this.ordersUrl}/mockup`, count ? { count } : {}).pipe(
      map((res) => ({ count: res.count || res.data.length, orders: res.data }))
    );
  }

  triggerRouting(): Observable<RoutingTriggerResult> {
    return this.http.post<RoutingTriggerResult>(`${this.rootUrl}/routing/trigger`, {});
  }

  resetAllOrders(): Observable<void> {
    return this.http.delete<ApiResponse<void>>(this.ordersUrl).pipe(map(() => undefined));
  }
}
