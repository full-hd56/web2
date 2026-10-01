import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { OrderService } from '../../services/order';
import {
  Order,
  OrderStatus,
  OrderStats,
  CreateOrderDto,
  UpdateOrderDto,
  RoutingTriggerResult,
} from '../../models/order';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface MsuPreset {
  label: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-management.html',
  styleUrls: ['./order-management.css'],
})
export class OrderManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  private orderService = inject(OrderService);
  private router = inject(Router);

  // Depot Info (MSU Khamriang)
  readonly DEPOT = {
    name: 'ศูนย์กระจายอาหารกลางวัน ม.มหาสารคาม (ขามเรียง)',
    lat: 16.2468,
    lng: 103.2520,
    maxRadiusKm: 3.0,
    boxPriceThb: 65,
    boxCostThb: 40,
    grossProfitThb: 25,
    maxBoxesPerRider: 10,
    peakWindow: '11:30 - 12:30 น.',
  };

  // State
  orders: Order[] = [];
  allOrders: Order[] = [];
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
  isRoutingTriggering = false;
  isResetting = false;

  // View & Filter States
  selectedStatus: OrderStatus | 'ALL' = 'ALL';
  searchTerm = '';
  viewMode: 'SPLIT' | 'TABLE' | 'MAP' = 'SPLIT';

  // Live Clock & Dispatch Countdown
  currentTime = '';
  private timerInterval: any;

  // Form State
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
  existingCustomerFound = false;
  currentDistanceKm = 0.27;
  isWithinRadius = true;

  // Modals & Dialogs
  isMapPinModalOpen = false;
  isResetConfirmOpen = false;
  isRoutingSuccessModalOpen = false;
  lastRoutingResult: RoutingTriggerResult | null = null;

  // Toasts
  toasts: Toast[] = [];
  private toastCounter = 0;

  // Leaflet Map References
  private map: L.Map | null = null;
  private markerLayerGroup: L.LayerGroup | null = null;
  private depotCircle: L.Circle | null = null;
  private selectionPinMarker: L.Marker | null = null;

  // MSU Landmarks Preset with calculated Haversine distance
  msuPresets: MsuPreset[] = [
    { label: 'หอพักตักศิลาแกรนด์', name: 'คุณกิตติศักดิ์ (ตักศิลา)', phone: '089-123-4567', lat: 16.2482, lng: 103.2541, distanceKm: 0.27 },
    { label: 'คณะวิทยาการสารสนเทศ (IT-MSU)', name: 'คุณนภัสสร (คณะ IT)', phone: '081-987-6543', lat: 16.2449, lng: 103.2498, distanceKm: 0.32 },
    { label: 'ตลาดน้อย มมส.', name: 'คุณพิมลวรรณ (ตลาดน้อย)', phone: '086-444-2390', lat: 16.2435, lng: 103.2510, distanceKm: 0.38 },
    { label: 'ซอยลีลา ขามเรียง', name: 'คุณธีรภัทร (ซอยลีลา)', phone: '094-555-8812', lat: 16.2515, lng: 103.2560, distanceKm: 0.67 },
    { label: 'หอพักอินเตอร์แมนชั่น', name: 'คุณอภิสิทธิ์ (อินเตอร์แมนชั่น)', phone: '092-333-9182', lat: 16.2530, lng: 103.2475, distanceKm: 0.84 },
    { label: 'คอนโดกัลปพฤกษ์ มมส.', name: 'คุณชลธิชา (กัลปพฤกษ์)', phone: '085-777-3321', lat: 16.2410, lng: 103.2555, distanceKm: 0.75 },
    { label: 'ศูนย์การค้าเสริมไทยคอมเพล็กซ์', name: 'คุณเอกภพ (เสริมไทย)', phone: '082-123-9988', lat: 16.2085, lng: 103.2750, distanceKm: 4.85 },
  ];

  // Customer Directory for Phone Lookup
  customerDirectory: { [phone: string]: { name: string; lat: number; lng: number } } = {
    '081-234-5678': { name: 'คุณมานี ศรีสวัสดิ์', lat: 16.2475, lng: 103.2535 },
    '089-111-2233': { name: 'คุณสมศรี มหาสารคาม', lat: 16.2450, lng: 103.2515 },
    '086-444-2390': { name: 'คุณพิมลวรรณ (ตลาดน้อย)', lat: 16.2435, lng: 103.2510 },
    '094-555-8812': { name: 'คุณธีรภัทร (ซอยลีลา)', lat: 16.2515, lng: 103.2560 },
    '089-123-4567': { name: 'คุณกิตติศักดิ์ (ตักศิลา)', lat: 16.2482, lng: 103.2541 },
    '081-987-6543': { name: 'คุณนภัสสร (คณะ IT)', lat: 16.2449, lng: 103.2498 },
  };

  get minRidersNeeded(): number {
    return Math.max(1, Math.ceil(this.stats.total_boxes / this.DEPOT.maxBoxesPerRider));
  }

  get totalFormPrice(): number {
    return this.formData.box_quantity * this.DEPOT.boxPriceThb;
  }

  get totalFormCost(): number {
    return this.formData.box_quantity * this.DEPOT.boxCostThb;
  }

  get totalFormProfit(): number {
    return this.formData.box_quantity * this.DEPOT.grossProfitThb;
  }

  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);
    this.recalculateDistance();
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Initialize map after Angular finishes DOM rendering
    setTimeout(() => {
      this.initMap();
    }, 200);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // ============================================================================
  // Leaflet Map Engine
  // ============================================================================
  private initMap(): void {
    const container = document.getElementById('orderMap');
    if (!container || this.map) return;

    // Create Leaflet Map centered at MSU Khamriang
    this.map = L.map('orderMap', {
      center: [this.DEPOT.lat, this.DEPOT.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    // Clean OpenStreetMap TileLayer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // Delivery Boundary: 3.0 KM Radius Circle
    this.depotCircle = L.circle([this.DEPOT.lat, this.DEPOT.lng], {
      radius: this.DEPOT.maxRadiusKm * 1000,
      color: '#EA580C',
      weight: 2,
      dashArray: '6, 8',
      fillColor: '#EA580C',
      fillOpacity: 0.05,
    }).addTo(this.map);

    // MSU Central Depot Marker
    const depotIcon = L.divIcon({
      className: 'custom-depot-pin',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="absolute w-12 h-12 rounded-full bg-orange-500/30 animate-ping"></span>
          <div class="relative w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-xl border-2 border-white font-bold text-sm">
            🍱
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const depotMarker = L.marker([this.DEPOT.lat, this.DEPOT.lng], { icon: depotIcon }).addTo(this.map);
    depotMarker.bindPopup(`
      <div class="p-3 text-xs">
        <div class="font-bold text-slate-900 text-sm mb-1">🏢 ${this.DEPOT.name}</div>
        <div class="text-slate-600">จุดศูนย์กลางกระจายอาหารกลางวัน</div>
        <div class="mt-2 text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded border border-amber-200">
          รัศมีจัดส่งสูงสุด: 3.0 กิโลเมตร
        </div>
      </div>
    `);

    // Layer group for all order pins
    this.markerLayerGroup = L.layerGroup().addTo(this.map);

    // Map Click Handler: Set coordinates directly from clicking map!
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.formData.latitude = parseFloat(e.latlng.lat.toFixed(5));
      this.formData.longitude = parseFloat(e.latlng.lng.toFixed(5));
      this.recalculateDistance();
      this.updateSelectionPin();

      if (this.isWithinRadius) {
        this.showToast(`📍 ปักหมุดพิกัดสำเร็จ (ห่างจากศูนย์ ${this.currentDistanceKm} กม.)`, 'success');
      } else {
        this.showToast(`⚠️ พิกัดอยู่นอกรัศมีจัดส่ง 3.0 กม. (ห่าง ${this.currentDistanceKm} กม.)`, 'warning');
      }
    });

    // Render current selection pin & loaded orders
    this.updateSelectionPin();
    this.renderOrderMarkers();
  }

  private updateSelectionPin(): void {
    if (!this.map) return;

    if (this.selectionPinMarker) {
      this.map.removeLayer(this.selectionPinMarker);
    }

    const pinColor = this.isWithinRadius ? 'bg-emerald-600' : 'bg-rose-600';
    const selectIcon = L.divIcon({
      className: 'custom-select-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-8 h-8 rounded-full ${this.isWithinRadius ? 'bg-emerald-400/40' : 'bg-rose-400/40'} animate-ping"></span>
          <div class="w-8 h-8 rounded-full ${pinColor} text-white flex items-center justify-center shadow-2xl border-2 border-white font-bold text-xs">
            📍
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

    const colorClasses: Record<OrderStatus, { bg: string; border: string }> = {
      PENDING: { bg: 'bg-amber-500', border: 'border-amber-200' },
      ROUTING: { bg: 'bg-indigo-600', border: 'border-indigo-200' },
      ASSIGNED: { bg: 'bg-purple-600', border: 'border-purple-200' },
      COMPLETED: { bg: 'bg-emerald-600', border: 'border-emerald-200' },
      CANCELLED: { bg: 'bg-rose-500', border: 'border-rose-200' },
    };

    for (const order of this.filteredOrders) {
      const style = colorClasses[order.status] || { bg: 'bg-slate-600', border: 'border-slate-200' };

      const icon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="group relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full ${style.bg} text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold font-mono">
              ${order.box_quantity}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const dist = order.distance_from_depot_km != null
        ? order.distance_from_depot_km.toFixed(2)
        : this.calculateHaversine(this.DEPOT.lat, this.DEPOT.lng, order.latitude, order.longitude).toFixed(2);

      const marker = L.marker([order.latitude, order.longitude], { icon });

      const popupHtml = `
        <div class="p-3 text-xs min-w-[200px]">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="font-bold text-slate-900 text-sm">${order.customer_name}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}">
              ${this.getStatusLabel(order.status)}
            </span>
          </div>
          <div class="text-slate-600 font-mono text-xs mb-1">📞 ${order.phone}</div>
          <div class="text-slate-500 mb-2">🍱 ${order.box_quantity} กล่อง · 📍 ห่างศูนย์ ${dist} กม.</div>
          <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <button onclick="window.dispatchEvent(new CustomEvent('edit-order-event', {detail: '${order.id}'}))" class="flex-1 py-1 px-2 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-medium border border-amber-200 text-center">
              ✏️ แก้ไข
            </button>
            <button onclick="window.dispatchEvent(new CustomEvent('cancel-order-event', {detail: '${order.id}'}))" class="flex-1 py-1 px-2 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-medium border border-rose-200 text-center">
              ✕ ยกเลิก
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.markerLayerGroup.addLayer(marker);
    }
  }

  // Map Navigation & Focus
  focusOrderOnMap(order: Order): void {
    if (!this.map) return;
    this.map.flyTo([order.latitude, order.longitude], 17, { duration: 0.8 });

    // Open popup
    if (this.markerLayerGroup) {
      this.markerLayerGroup.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          const latlng = layer.getLatLng();
          if (
            Math.abs(latlng.lat - order.latitude) < 0.0001 &&
            Math.abs(latlng.lng - order.longitude) < 0.0001
          ) {
            layer.openPopup();
          }
        }
      });
    }
  }

  resetMapView(): void {
    if (!this.map) return;
    this.map.flyTo([this.DEPOT.lat, this.DEPOT.lng], 15, { duration: 0.8 });
  }

  setViewMode(mode: 'SPLIT' | 'TABLE' | 'MAP'): void {
    this.viewMode = mode;
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 150);
  }

  // ============================================================================
  // Distance & Coordinates Calculation
  // ============================================================================
  calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  recalculateDistance(): void {
    const lat = Number(this.formData.latitude);
    const lng = Number(this.formData.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      this.currentDistanceKm = parseFloat(
        this.calculateHaversine(this.DEPOT.lat, this.DEPOT.lng, lat, lng).toFixed(2)
      );
      this.isWithinRadius = this.currentDistanceKm <= this.DEPOT.maxRadiusKm;
    }
  }

  onCoordinateChange(): void {
    this.recalculateDistance();
    this.updateSelectionPin();
  }

  // ============================================================================
  // Data Loading & Filtering
  // ============================================================================
  loadData(): void {
    this.isLoading = true;
    this.orderService.getOrders('ALL', this.searchTerm).subscribe({
      next: (data) => {
        this.allOrders = data;
        this.orders = data;
        this.isLoading = false;

        // Auto-index into customer directory
        for (const o of data) {
          const clean = this.normalizePhone(o.phone);
          if (!this.customerDirectory[clean]) {
            this.customerDirectory[clean] = {
              name: o.customer_name,
              lat: o.latitude,
              lng: o.longitude,
            };
          }
        }

        this.renderOrderMarkers();
      },
      error: (err) => {
        this.isLoading = false;
        this.showToast('ไม่สามารถโหลดข้อมูลออเดอร์ได้: ' + (err.error?.error || err.message), 'error');
      },
    });

    this.orderService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
      error: (err) => console.error('Failed to load stats', err),
    });
  }

  get filteredOrders(): Order[] {
    let result = this.orders;
    if (this.selectedStatus !== 'ALL') {
      result = result.filter((o) => o.status === this.selectedStatus);
    }
    return result;
  }

  setFilterStatus(status: OrderStatus | 'ALL'): void {
    this.selectedStatus = status;
    this.renderOrderMarkers();
  }

  onSearchChange(): void {
    this.loadData();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.loadData();
  }

  // ============================================================================
  // Phone Formatting & Fast Customer Lookup
  // ============================================================================
  normalizePhone(phone: string): string {
    return phone.trim().replace(/\s+/g, '');
  }

  onPhoneInput(): void {
    if (!this.formData.phone) {
      this.existingCustomerFound = false;
      return;
    }

    // Auto format phone number as 08x-xxx-xxxx
    let digits = this.formData.phone.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(0, 10);

    if (digits.length >= 7) {
      this.formData.phone = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 4) {
      this.formData.phone = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      this.formData.phone = digits;
    }

    // Live auto-check if customer phone matches directory
    const clean = this.normalizePhone(this.formData.phone);
    if (this.customerDirectory[clean]) {
      const match = this.customerDirectory[clean];
      this.formData.customer_name = match.name;
      this.formData.latitude = match.lat;
      this.formData.longitude = match.lng;
      this.existingCustomerFound = true;
      this.recalculateDistance();
      this.updateSelectionPin();
    } else {
      this.existingCustomerFound = false;
    }
  }

  lookupCustomer(): void {
    const raw = this.normalizePhone(this.formData.phone);
    if (!raw) {
      this.showToast('กรุณากรอกเบอร์โทรศัพท์ก่อนกดค้นหา', 'warning');
      return;
    }

    let found = this.customerDirectory[raw];
    if (!found) {
      const digitsOnly = raw.replace(/\D/g, '');
      const matchKey = Object.keys(this.customerDirectory).find(
        (k) => k.replace(/\D/g, '') === digitsOnly
      );
      if (matchKey) {
        found = this.customerDirectory[matchKey];
      }
    }

    if (found) {
      this.formData.customer_name = found.name;
      this.formData.latitude = parseFloat(found.lat.toFixed(5));
      this.formData.longitude = parseFloat(found.lng.toFixed(5));
      this.existingCustomerFound = true;
      this.formError = '';
      this.recalculateDistance();
      this.updateSelectionPin();
      this.showToast(`✓ พบประวัติลูกค้า: ${found.name}`, 'success');
    } else {
      this.existingCustomerFound = false;
      this.showToast('ไม่พบประวัติลูกค้าเก่า สามารถกรอกชื่อและพิกัดใหม่ได้ทันที', 'info');
    }
  }

  setBoxQuantity(qty: number): void {
    this.formData.box_quantity = qty;
  }

  selectPreset(preset: MsuPreset): void {
    this.formData.customer_name = preset.name;
    this.formData.phone = preset.phone;
    this.formData.latitude = preset.lat;
    this.formData.longitude = preset.lng;
    this.existingCustomerFound = true;
    this.isMapPinModalOpen = false;
    this.recalculateDistance();
    this.updateSelectionPin();
    this.showToast(`📍 เลือกพิกัด: ${preset.label} (${preset.distanceKm} กม.)`, 'success');
  }

  // ============================================================================
  // Form Submission (Add or Edit)
  // ============================================================================
  submitOrder(): void {
    this.formError = '';

    if (!this.formData.phone.trim()) {
      this.formError = 'กรุณาระบุเบอร์โทรศัพท์';
      return;
    }
    if (!this.formData.customer_name.trim()) {
      this.formError = 'กรุณาระบุชื่อลูกค้า';
      return;
    }
    if (this.formData.box_quantity < 1 || this.formData.box_quantity > 3) {
      this.formError = 'จำนวนกล่องข้าวต้องอยู่ระหว่าง 1 ถึง 3 กล่อง';
      return;
    }
    if (isNaN(this.formData.latitude) || isNaN(this.formData.longitude)) {
      this.formError = 'กรุณาระบุพิกัดละติจูดและลองจิจูดให้ถูกต้อง';
      return;
    }

    if (this.isEditing && this.editingOrderId) {
      const dto: UpdateOrderDto = {
        customer_name: this.formData.customer_name.trim(),
        phone: this.formData.phone.trim(),
        latitude: this.formData.latitude,
        longitude: this.formData.longitude,
        box_quantity: this.formData.box_quantity,
      };

      this.orderService.updateOrder(this.editingOrderId, dto).subscribe({
        next: () => {
          this.showToast(`✓ แก้ไขออเดอร์ ${this.editingOrderId} สำเร็จ`, 'success');
          this.resetForm();
          this.loadData();
        },
        error: (err) => {
          this.formError = err.error?.error || err.message;
        },
      });
    } else {
      const dto: CreateOrderDto = {
        customer_name: this.formData.customer_name.trim(),
        phone: this.formData.phone.trim(),
        latitude: this.formData.latitude,
        longitude: this.formData.longitude,
        box_quantity: this.formData.box_quantity,
      };

      this.orderService.createOrder(dto).subscribe({
        next: (created) => {
          this.showToast(`✓ บันทึกออเดอร์ใหม่สำเร็จ (${created.id})`, 'success');
          this.customerDirectory[this.normalizePhone(dto.phone)] = {
            name: dto.customer_name,
            lat: dto.latitude,
            lng: dto.longitude,
          };
          this.resetForm();
          this.loadData();
        },
        error: (err) => {
          this.formError = err.error?.error || err.message;
        },
      });
    }
  }

  editOrder(order: Order): void {
    this.isEditing = true;
    this.editingOrderId = order.id;
    this.formData = {
      customer_name: order.customer_name,
      phone: order.phone,
      latitude: order.latitude,
      longitude: order.longitude,
      box_quantity: order.box_quantity,
    };
    this.existingCustomerFound = false;
    this.formError = '';
    this.recalculateDistance();
    this.updateSelectionPin();
    this.focusOrderOnMap(order);
  }

  resetForm(): void {
    this.isEditing = false;
    this.editingOrderId = '';
    this.formData = {
      customer_name: '',
      phone: '',
      latitude: 16.2482,
      longitude: 103.2541,
      box_quantity: 2,
    };
    this.existingCustomerFound = false;
    this.formError = '';
    this.recalculateDistance();
    this.updateSelectionPin();
  }

  cancelOrder(order: Order): void {
    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        this.showToast(`ยกเลิกออเดอร์ ${order.id} แล้ว`, 'info');
        this.loadData();
      },
      error: (err) => {
        this.showToast('ยกเลิกไม่สำเร็จ: ' + (err.error?.error || err.message), 'error');
      },
    });
  }

  deleteOrder(order: Order): void {
    if (confirm(`คุณต้องการลบออเดอร์ของ "${order.customer_name}" ออกจากระบบหรือไม่?`)) {
      this.orderService.deleteOrder(order.id).subscribe({
        next: () => {
          this.showToast(`ลบออเดอร์สำเร็จ`, 'info');
          if (this.editingOrderId === order.id) {
            this.resetForm();
          }
          this.loadData();
        },
        error: (err) => {
          this.showToast('ลบออเดอร์ไม่สำเร็จ: ' + (err.error?.error || err.message), 'error');
        },
      });
    }
  }

  // ============================================================================
  // Mockup & Reset Actions
  // ============================================================================
  generateMockup(): void {
    this.isGeneratingMockup = true;
    this.orderService.generateMockup().subscribe({
      next: (res) => {
        this.isGeneratingMockup = false;
        this.showToast(`🎲 สุ่มสร้างข้อมูลจำลองสำเร็จ ${res.count} ออเดอร์`, 'success');
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
  }

  closeResetConfirm(): void {
    this.isResetConfirmOpen = false;
  }

  confirmResetAll(): void {
    this.isResetting = true;
    this.orderService.resetAllOrders().subscribe({
      next: () => {
        this.isResetting = false;
        this.isResetConfirmOpen = false;
        this.showToast('🗑️ ล้างข้อมูลออเดอร์ทั้งหมดเรียบร้อยแล้ว', 'info');
        this.resetForm();
        this.loadData();
      },
      error: (err) => {
        this.isResetting = false;
        this.showToast('ล้างข้อมูลล้มเหลว: ' + (err.error?.error || err.message), 'error');
      },
    });
  }

  // ============================================================================
  // Trigger Routing Action
  // ============================================================================
  triggerRoutingAndNavigate(): void {
    if (this.orders.length === 0) {
      this.showToast('ไม่มีรายการออเดอร์สำหรับจัดเส้นทาง', 'warning');
      return;
    }

    this.isRoutingTriggering = true;
    this.orderService.triggerRouting().subscribe({
      next: (result) => {
        this.isRoutingTriggering = false;
        this.lastRoutingResult = result;
        this.showToast(`🚀 ส่งออเดอร์เข้าสู่ระบบ CVRPTW สำเร็จ! (${result.total_orders_routed} รายการ)`, 'success');
        setTimeout(() => {
          this.router.navigate(['/routes'], {
            queryParams: { jobId: result.job_id },
          });
        }, 600);
      },
      error: (err) => {
        this.isRoutingTriggering = false;
        if (err.error?.error?.includes('ไม่มีออเดอร์สถานะ PENDING')) {
          this.router.navigate(['/routes']);
        } else {
          this.showToast('เริ่มจัดเส้นทางล้มเหลว: ' + (err.error?.error || err.message), 'error');
        }
      },
    });
  }

  // Helpers
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message, type });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 4000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  openMapPinModal(): void {
    this.isMapPinModalOpen = true;
  }

  closeMapPinModal(): void {
    this.isMapPinModalOpen = false;
  }

  getStatusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'รอจัดเส้นทาง';
      case 'ROUTING': return 'กำลังจัดเส้นทาง';
      case 'ASSIGNED': return 'มอบหมายแล้ว';
      case 'COMPLETED': return 'จัดส่งสำเร็จ';
      case 'CANCELLED': return 'ยกเลิกแล้ว';
      default: return status;
    }
  }

  getStatusBadgeClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'status-pill-pending';
      case 'ROUTING': return 'status-pill-routing';
      case 'ASSIGNED': return 'status-pill-assigned';
      case 'COMPLETED': return 'status-pill-completed';
      case 'CANCELLED': return 'status-pill-cancelled';
      default: return 'bg-slate-100 text-slate-700';
    }
  }
}

