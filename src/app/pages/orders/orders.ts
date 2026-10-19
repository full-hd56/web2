import { Sidebar } from '../../components/sidebar/sidebar';
import { Component, OnInit, AfterViewInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as L from 'leaflet';
import { OrderService } from '../../services/order';
import { Order, OrderStatus, OrderStats } from '../../models/order';

import { HttpClient } from '@angular/common/http';
import { Customer } from '../../models/customer';


interface Toast {  //กล่องข้อความแจ้งเตือนเล็กๆ
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Sidebar],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders implements OnInit, AfterViewInit, OnDestroy {
  private orderService = inject(OrderService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  //******************** */
  //เพิ่ม order  //dropdown ลูกค้า
  private http = inject(HttpClient);
  customers: Customer[] = [];
  selected_customer_id_dropdown: number | null = null;
  //*********************** */

  // Depot
  start_point = {
    name: 'ม.มหาสารคาม (ขามเรียง)',
    lat: 16.2468,
    lng: 103.2520,
    maxRadiusKm: 3.0,
    boxPriceThb: 65,
    boxCostThb: 40,
    grossProfitThb: 25,
  };

  STATUS_META: Record<OrderStatus, { label: string; badge: string; bg: string }> = {
    PENDING: { label: 'รอจัดเส้นทาง', badge: 'status-pill-pending', bg: 'bg-amber-500' },
    ROUTING: { label: 'กำลังจัดเส้นทาง', badge: 'status-pill-routing', bg: 'bg-indigo-600' },
    ASSIGNED: { label: 'มอบหมายแล้ว', badge: 'status-pill-assigned', bg: 'bg-purple-600' },
    COMPLETED: { label: 'จัดส่งสำเร็จ', badge: 'status-pill-completed', bg: 'bg-emerald-600' },
    CANCELLED: { label: 'ยกเลิกแล้ว', badge: 'status-pill-cancelled', bg: 'bg-rose-500' },
  };

  filterTabs: Array<{ status: OrderStatus | 'ALL'; label: string; countKey: keyof OrderStats }> = [
    { status: 'ALL', label: 'ทั้งหมด', countKey: 'total_orders' },
    { status: 'PENDING', label: 'รอจัดเส้นทาง', countKey: 'pending_orders' },
    { status: 'ROUTING', label: 'กำลังจัดเส้นทาง', countKey: 'routing_orders' },
    { status: 'ASSIGNED', label: 'อยู่ในใบงานแล้ว', countKey: 'assigned_orders' },
    { status: 'COMPLETED', label: 'จัดส่งสำเร็จ', countKey: 'completed_orders' },
    { status: 'CANCELLED', label: 'ยกเลิกแล้ว', countKey: 'cancelled_orders' },
  ];

  viewModes: Array<{ id: 'TABLE' | 'SPLIT' | 'MAP'; label: string; icon: string }> = [
    { id: 'TABLE', label: 'ตารางรายการ', icon: 'table_view' },
    { id: 'SPLIT', label: 'แยกจอ (ตาราง + แผนที่)', icon: 'vertical_split' },
    { id: 'MAP', label: 'แผนที่พิกัดเต็มจอ', icon: 'map' },
  ];

  orders: Order[] = [];
  stats: OrderStats = {
    total_orders: 0,
    total_boxes: 0,
    pending_orders: 0,
    routing_orders: 0,
    assigned_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_revenue_thb: 0,
    total_cost_thb: 0,
    gross_profit_thb: 0,
  };

  isLoading = false;
  isGeneratingMockup = false;
  is_planning = false;
  isResetting = false;

  selectedStatus: OrderStatus | 'ALL' = 'ALL';
  searchTerm = '';
  viewMode: 'TABLE' | 'SPLIT' | 'MAP' = 'TABLE';
  private searchSubject = new Subject<string>();
  private searchSub: Subscription | null = null;

  isEditing = false;
  editingOrderId = '';

  formData = {
    customer_name: '',
    phone: '',
    latitude: 16.2482,
    longitude: 103.2541,
    box_quantity: 2,
  };

  formError = '';
  currentDistanceKm = 0.27;
  isWithinRadius = true;

  isResetConfirmOpen = false;

  toasts: Toast[] = [];
  private toastCounter = 0;

  private map: L.Map | null = null;
  private markerLayerGroup: L.LayerGroup | null = null;
  private selectionPinMarker: L.Marker | null = null;

  // เริ่มต้น / ปิดหน้า
  ngOnInit(): void {
    this.recalculateDistance();
    this.loadData();
    this.searchSub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((term) => {
        this.searchTerm = term;
        this.loadOrders();
      });
    window.addEventListener('edit-order-event', this.onCustomEdit);
    window.addEventListener('cancel-order-event', this.onCustomCancel);

    ///////////////////////////
    //dropdown customer
    this.load_customers();
    //////////////////////////
  }

  ngAfterViewInit(): void {
    if (this.viewMode !== 'TABLE') {
      setTimeout(() => this.initMap(), 200);
    }
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    window.removeEventListener('edit-order-event', this.onCustomEdit);
    window.removeEventListener('cancel-order-event', this.onCustomCancel);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // โหลดข้อมูลจาก backend
  loadData(): void {
    this.loadOrders();
    this.loadStats();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.orderService.getOrders('ALL', this.searchTerm).subscribe({
      next: (data) => {
        this.orders = data;
        this.isLoading = false;
        this.renderOrderMarkers();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('ไม่สามารถโหลดข้อมูลออเดอร์ได้: ' + (err.error?.error || err.message), 'error');
        this.cdr.markForCheck();
      },
    });
  }

  loadStats(): void {
    this.orderService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Failed to load stats', err),
    });
  }

  /////////////////
  //dropdown
  // ดึงรายชื่อลูกค้าทั้งหมดจาก database
  load_customers(): void {
    this.http.get<Customer[]>('https://back-n-web2.vercel.app/customer').subscribe({
      next: (data) => {
        this.customers = data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.formError = 'โหลดรายชื่อลูกค้าไม่สำเร็จ';
        this.cdr.markForCheck();
      },
    });
  }

  //  ฟอร์มออเดอร์ (เพิ่ม / แก้ไข)
  // ลูกค้าที่เลือกอยู่ (ใช้แสดงการ์ดสรุปใต้ dropdown)
  get selectedCustomer(): Customer | undefined {
    return this.customers.find((x) => x.id === Number(this.selected_customer_id_dropdown));
  }

  // เลือกลูกค้าจาก dropdown แล้วเติมข้อมูลลงฟอร์มให้อัตโนมัติ
  customer_select(): void {
    const c = this.customers.find((x) => x.id === Number(this.selected_customer_id_dropdown));
    if (!c) return;
    this.formData.customer_name = c.name;
    this.formData.phone = c.phone;
    this.formData.latitude = Number(c.latitude);
    this.formData.longitude = Number(c.longitude);
    this.recalculateDistance();
    this.updateSelectionPin();
  }

  setBoxQuantity(qty: number): void { this.formData.box_quantity = qty; }

  submitOrder(): void {
    this.formError = '';
    const { customer_name, phone, box_quantity, latitude, longitude } = this.formData;

    ////////// dropdown/////////////////
    //if (!phone.trim()) return void (this.formError = 'กรุณาเลือกลูกค้า');
    if (!this.selected_customer_id_dropdown) return void (this.formError = 'กรุณาเลือกลูกค้า');
    ////////// ///////////////////////
    if (box_quantity < 1 || box_quantity > 3) return void (this.formError = 'จำนวนกล่องข้าวต้องอยู่ระหว่าง 1 ถึง 3 กล่อง');

    const order_data = {
      customer_id: this.selected_customer_id_dropdown,   // แก้ dropdown
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      latitude,
      longitude,
      box_quantity,
    };

    const action$ = this.isEditing && this.editingOrderId
      ? this.orderService.updateOrder(this.editingOrderId, order_data)
      : this.orderService.createOrder(order_data);

    action$.subscribe({
      next: (res) => {
        this.showToast(this.isEditing ? ` แก้ไขออเดอร์ ${this.editingOrderId} สำเร็จ` : ` บันทึกออเดอร์ใหม่สำเร็จ (${res.id})`, 'success');
        this.resetForm();
        this.loadData();
      },
      error: (err) => { this.formError = err.error?.error || err.message; },
    });
  }

  editOrder(order: Order): void {
    this.isEditing = true;
    this.editingOrderId = order.id;

    ////////////  dropdown
    this.selected_customer_id_dropdown = this.customers.find((c) => c.phone === order.phone)?.id ?? null;
    ///////////

    this.formData = {
      customer_name: order.customer_name,
      phone: order.phone,
      latitude: order.latitude,
      longitude: order.longitude,
      box_quantity: order.box_quantity,
    };
    this.formError = '';
    this.recalculateDistance();
    this.updateSelectionPin();
    this.focusOrderOnMap(order);
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingOrderId = '';

    /// dropdown ////
    this.selected_customer_id_dropdown = null;
    /////////////////

    this.formData = {
      customer_name: '',
      phone: '',
      latitude: 16.2482,
      longitude: 103.2541,
      box_quantity: 2,
    };
    this.formError = '';
    this.recalculateDistance();
    this.updateSelectionPin();
  }

  // ยกเลิก / ลบออเดอร์
  cancelOrder(order: Order): void {
    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        this.showToast(`ยกเลิกออเดอร์ ${order.id} แล้ว`, 'info');
        this.loadData();
      },
      error: (err) => this.showToast('ยกเลิกไม่สำเร็จ: ' + (err.error?.error || err.message), 'error'),
    });
  }

  deleteOrder(order: Order): void {
    if (!confirm(`คุณต้องการลบออเดอร์ของ "${order.customer_name}" ออกจากระบบหรือไม่?`)) return;
    if (this.editingOrderId === order.id) this.resetForm();

    this.orderService.deleteOrder(order.id).subscribe({
      next: () => {
        this.showToast('ลบออเดอร์สำเร็จ', 'info');
        this.loadData();
      },
      error: (err) => this.showToast('ลบออเดอร์ไม่สำเร็จ: ' + (err.error?.error || err.message), 'error'),
    });
  }

  // ============================================================================
  // จัดเส้นทาง สร้างใบงาน
  // จัดเส้นทาง สร้างใบงาน (POST /api/delivery_tasks/plan) แล้วไปหน้า route_dashborad
  plan_delivery_tasks(): void {
    if (this.orders.length === 0) {
      this.showToast('ไม่มีรายการออเดอร์สำหรับจัดเส้นทาง', 'warning');
      return;
    }
    this.is_planning = true;
    this.orderService.plan_delivery_tasks().subscribe({
      next: (result) => {
        this.is_planning = false;
        this.showToast(`จัดเส้นทางสำเร็จ! ได้ ${result.count} ใบงาน`, 'success');
        //setTimeout(() => this.router.navigate(['/routes']), 600);
        this.router.navigate(['/routes']);
      },
      error: (err) => {
        this.is_planning = false;
        if (err.error?.error?.includes('ไม่มีออเดอร์รอจัดเส้นทาง')) {
          this.router.navigate(['/routes']);
        } else {
          this.showToast('เริ่มจัดเส้นทางล้มเหลว: ' + (err.error?.error || err.message), 'error');
        }
      },
    });
  }

  // ข้อมูลทดสอบ / ล้างข้อมูลทั้งหมด
  generateMockup(): void {
    this.isGeneratingMockup = true;
    this.orderService.generateMockup().subscribe({
      next: (res) => {
        this.isGeneratingMockup = false;
        this.showToast(`สุ่มสร้างข้อมูลจำลองสำเร็จ ${res.count} ออเดอร์`, 'success');
        this.loadData();
      },
      error: (err) => {
        this.isGeneratingMockup = false;
        this.showToast('สร้างข้อมูลจำลองล้มเหลว: ' + (err.error?.error || err.message), 'error');
      },
    });
  }

  openResetConfirm(): void {
    this.isResetConfirmOpen = true;
    this.isResetting = false;
    this.cdr.detectChanges();
  }

  closeResetConfirm(): void {
    this.isResetConfirmOpen = false;
    this.isResetting = false;
    this.cdr.detectChanges();
  }

  confirmResetAll(): void {
    // 1. ปิด Modal ทันที ไม่ให้ค้างอยู่บนหน้าจอเด็ดขาด
    this.isResetConfirmOpen = false;
    this.isResetting = false;

    // 2. ล้างข้อมูลหน้าจอทันทีแบบ Real-time
    this.orders = [];
    this.stats = {
      total_orders: 0,
      total_boxes: 0,
      pending_orders: 0,
      routing_orders: 0,
      assigned_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      total_revenue_thb: 0,
      total_cost_thb: 0,
      gross_profit_thb: 0,
    };
    this.markerLayerGroup?.clearLayers();
    this.resetForm();
    this.showToast('ล้างข้อมูลออเดอร์ทั้งหมดเรียบร้อยแล้ว', 'info');
    this.cdr.detectChanges();

    // 3. ส่งคำขอลบไปยัง Server ในเบื้องหลัง
    this.orderService.resetAllOrders().subscribe({
      next: () => {},
      error: (err) => {
        this.showToast('ล้างข้อมูลล้มเหลว: ' + (err.error?.error || err.message), 'error');
        this.loadData();
      },
    });
  }

  // UI:
  get filteredOrders(): Order[] {
    return this.selectedStatus === 'ALL' ? this.orders : this.orders.filter((o) => o.status === this.selectedStatus);
  }

  setFilterStatus(status: OrderStatus | 'ALL'): void {
    this.selectedStatus = status;
    this.renderOrderMarkers();
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.searchSubject.next('');
    this.loadOrders();
  }


  // UI แผนที่ Leaflet
  private initMap(): void {
    const container = document.getElementById('orderMap');
    if (!container || this.map) return;

    this.map = L.map('orderMap', {
      center: [this.start_point.lat, this.start_point.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);

    L.circle([this.start_point.lat, this.start_point.lng], {
      radius: this.start_point.maxRadiusKm * 1000,
      color: '#EA580C',
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#EA580C',
      fillOpacity: 0.05,
    }).addTo(this.map);

    const depotIcon = L.divIcon({
      className: 'custom-depot-pin',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="absolute w-12 h-12 rounded-full bg-orange-500/30 animate-ping"></span>
          <div class="relative w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white font-bold text-sm">
            <span class="icon" aria-hidden="true">bento</span>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const depotMarker = L.marker([this.start_point.lat, this.start_point.lng], { icon: depotIcon }).addTo(this.map);
    depotMarker.bindPopup(`
      <div class="p-3 text-xs">
        <div class="font-bold text-slate-900 text-sm mb-1"><span class="icon" aria-hidden="true">warehouse</span> ${this.start_point.name}</div>
        <div class="text-slate-600">จุดศูนย์กลางกระจายอาหารกลางวัน</div>
        <div class="mt-2 text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200">
          รัศมีจัดส่งสูงสุด: 3.0 กิโลเมตร
        </div>
      </div>
    `);

    this.markerLayerGroup = L.layerGroup().addTo(this.map);

    this.updateSelectionPin();
    this.renderOrderMarkers();
  }

  private updateSelectionPin(): void {
    if (!this.map) return;
    if (this.selectionPinMarker) this.map.removeLayer(this.selectionPinMarker);

    const pinColor = this.isWithinRadius ? 'bg-emerald-600' : 'bg-rose-600';
    const selectIcon = L.divIcon({
      className: 'custom-select-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-8 h-8 rounded-full ${this.isWithinRadius ? 'bg-emerald-400/40' : 'bg-rose-400/40'} animate-ping"></span>
          <div class="w-8 h-8 rounded-full ${pinColor} text-white flex items-center justify-center shadow-2xl border-2 border-white font-bold text-xs">
            <span class="icon" aria-hidden="true">location_on</span>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    this.selectionPinMarker = L.marker([this.formData.latitude, this.formData.longitude], {
      icon: selectIcon,
      zIndexOffset: 1000,
    }).addTo(this.map);
  }

  private renderOrderMarkers(): void {
    if (!this.map || !this.markerLayerGroup) return;
    this.markerLayerGroup.clearLayers();

    for (const order of this.filteredOrders) {
      const meta = this.STATUS_META[order.status] || { bg: 'bg-slate-600', label: order.status };
      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="group relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full ${meta.bg} text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold font-mono">
              ${order.box_quantity}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const dist = this.getOrderDistance(order);
      const marker = L.marker([order.latitude, order.longitude], { icon });
      marker.bindPopup(`
        <div class="p-3 text-xs min-w-[200px]">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="font-bold text-slate-900 text-sm">${order.customer_name}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">
              ${this.getStatusLabel(order.status)}
            </span>
          </div>
          <div class="text-slate-600 font-mono text-xs mb-1"><span class="icon" aria-hidden="true">call</span> ${order.phone}</div>
          <div class="text-slate-500 mb-2"><span class="icon" aria-hidden="true">bento</span> ${order.box_quantity} กล่อง · <span class="icon" aria-hidden="true">location_on</span> ห่างศูนย์ ${dist} กม.</div>
          <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <button onclick="window.dispatchEvent(new CustomEvent('edit-order-event', {detail: '${order.id}'}))" class="flex-1 py-1 px-2 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-medium border border-amber-200 text-center">
              <span class="icon" aria-hidden="true">edit</span> แก้ไข
            </button>
            <button onclick="window.dispatchEvent(new CustomEvent('cancel-order-event', {detail: '${order.id}'}))" class="flex-1 py-1 px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-medium border border-rose-200 text-center">
              <span class="icon" aria-hidden="true">close</span> ยกเลิก
            </button>
          </div>
        </div>
      `);
      this.markerLayerGroup.addLayer(marker);
    }
  }

  focusOrderOnMap(order: Order): void {
    if (this.viewMode === 'TABLE') {
      this.setViewMode('SPLIT');
    }
    setTimeout(() => {
      if (!this.map) {
        this.initMap();
      }
      if (this.map) {
        this.map.flyTo([order.latitude, order.longitude], 17, { duration: 0.8 });
        if (this.markerLayerGroup) {
          this.markerLayerGroup.eachLayer((layer: any) => {
            if (layer instanceof L.Marker) {
              const latlng = layer.getLatLng();
              if (Math.abs(latlng.lat - order.latitude) < 0.0001 && Math.abs(latlng.lng - order.longitude) < 0.0001) {
                layer.openPopup();
              }
            }
          });
        }
      }
    }, 150);
  }

  resetMapView(): void {
    if (this.map) this.map.flyTo([this.start_point.lat, this.start_point.lng], 15, { duration: 0.8 });
  }

  setViewMode(mode: 'TABLE' | 'SPLIT' | 'MAP'): void {
    this.viewMode = mode;
    if (mode === 'SPLIT' || mode === 'MAP') {
      setTimeout(() => {
        if (!this.map) {
          this.initMap();
        } else {
          this.map.invalidateSize();
          this.renderOrderMarkers();
        }
      }, 100);
    }
  }

  // ปุ่ม แก้ไข / ยกเลิก ในป๊อปอัปบนแผนที่ (ส่ง event มาที่นี่)
  private onCustomEdit = (e: any) => {
    const order = this.orders.find((o) => o.id === e.detail);
    if (order) this.editOrder(order);
  };
  private onCustomCancel = (e: any) => {
    const order = this.orders.find((o) => o.id === e.detail);
    if (order) this.cancelOrder(order);
  };


  // UI: คำนวณระยะทาง (ใช้กับแผนที่ และสีหมุด)
  calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  getOrderDistance(order: Order): number {
    return order.distance_from_depot_km != null
      ? order.distance_from_depot_km
      : parseFloat(this.calculateHaversine(this.start_point.lat, this.start_point.lng, order.latitude, order.longitude).toFixed(2));
  }

  recalculateDistance(): void {
    const lat = Number(this.formData.latitude), lng = Number(this.formData.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.currentDistanceKm = parseFloat(this.calculateHaversine(this.start_point.lat, this.start_point.lng, lat, lng).toFixed(2));
      this.isWithinRadius = this.currentDistanceKm <= this.start_point.maxRadiusKm;
    }
  }

  // UI ราคาในฟอร์ม / แจ้งเตือน / ตัวช่วย
  get totalFormPrice(): number { return this.formData.box_quantity * this.start_point.boxPriceThb; }
  get totalFormCost(): number { return this.formData.box_quantity * this.start_point.boxCostThb; }
  get totalFormProfit(): number { return this.formData.box_quantity * this.start_point.grossProfitThb; }

  // แสดงกล่องแจ้งเตือน แล้วหายเองใน 4 วินาที
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), 4000);
  }

  removeToast(id: number): void { this.toasts = this.toasts.filter((t) => t.id !== id); }
  getStatusLabel(status: OrderStatus): string {
    return this.STATUS_META[status]?.label ?? status;
  }
}