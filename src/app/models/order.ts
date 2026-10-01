export type OrderStatus = 'PENDING' | 'ROUTING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';

export interface Order {
  id: string;
  customer_name: string;
  phone: string;
  latitude: number;
  longitude: number;
  box_quantity: number; // 1 to 3 boxes
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  distance_from_depot_km?: number;
}

export interface CreateOrderDto {
  customer_name: string;
  phone: string;
  latitude: number;
  longitude: number;
  box_quantity: number;
}

export interface UpdateOrderDto {
  customer_name?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  box_quantity?: number;
  status?: OrderStatus;
}

export interface OrderStats {
  total_orders: number;
  total_boxes: number;
  pending_orders: number;
  routing_orders: number;
  assigned_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue_thb: number; // 65 THB per box
  total_cost_thb: number;    // 40 THB per box
  gross_profit_thb: number;  // 25 THB per box
}

export interface RoutingTriggerResult {
  job_id: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'OPTIMIZED';
  triggered_at: string;
  total_orders_routed: number;
  total_boxes_routed: number;
  message: string;
  next_step_url: string;
  data: Order[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  total?: number;
  data: T;
  error?: string;
}
