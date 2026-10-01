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
  private readonly baseUrl = 'http://localhost:3000/api/v1';

  constructor(private http: HttpClient) {}

  /**
   * Fetch orders list with optional status and text search filtering
   */
  getOrders(status?: OrderStatus | 'ALL', search?: string): Observable<Order[]> {
    let params = new HttpParams();

    if (status && status !== 'ALL') {
      params = params.set('status', status);
    }
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http
      .get<ApiResponse<Order[]>>(`${this.baseUrl}/orders`, { params })
      .pipe(map((res) => res.data));
  }

  /**
   * Get single order by ID
   */
  getOrderById(id: string): Observable<Order> {
    return this.http
      .get<ApiResponse<Order>>(`${this.baseUrl}/orders/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Fetch current stats summary
   */
  getStats(): Observable<OrderStats> {
    return this.http
      .get<ApiResponse<OrderStats>>(`${this.baseUrl}/orders/stats`)
      .pipe(map((res) => res.data));
  }

  /**
   * Create a new storefront order manually
   */
  createOrder(dto: CreateOrderDto): Observable<Order> {
    return this.http
      .post<ApiResponse<Order>>(`${this.baseUrl}/orders`, dto)
      .pipe(map((res) => res.data));
  }

  /**
   * Update existing order info or box count (1-3)
   */
  updateOrder(id: string, dto: UpdateOrderDto): Observable<Order> {
    return this.http
      .put<ApiResponse<Order>>(`${this.baseUrl}/orders/${id}`, dto)
      .pipe(map((res) => res.data));
  }

  /**
   * Cancel an order (change status to CANCELLED)
   */
  cancelOrder(id: string): Observable<Order> {
    return this.http
      .patch<ApiResponse<Order>>(`${this.baseUrl}/orders/${id}/cancel`, {})
      .pipe(map((res) => res.data));
  }

  /**
   * Delete order completely
   */
  deleteOrder(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/orders/${id}`)
      .pipe(map(() => undefined));
  }

  /**
   * Generate 20-30 mockup orders uniformly distributed in 3km around MSU depot
   */
  generateMockup(count?: number): Observable<{ count: number; orders: Order[] }> {
    const payload = count ? { count } : {};
    return this.http
      .post<ApiResponse<Order[]>>(`${this.baseUrl}/orders/mockup`, payload)
      .pipe(
        map((res) => ({
          count: res.count || res.data.length,
          orders: res.data,
        }))
      );
  }

  /**
   * Trigger CVRPTW optimization engine (11:30 peak batch trigger)
   */
  triggerRouting(): Observable<RoutingTriggerResult> {
    return this.http.post<RoutingTriggerResult>(
      `${this.baseUrl}/routing/trigger`,
      {}
    );
  }

  /**
   * Clear all orders (for simulator testing)
   */
  resetAllOrders(): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`${this.baseUrl}/orders`)
      .pipe(map(() => undefined));
  }
}
