import { Sidebar } from '../../components/sidebar/sidebar';
import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { OrderService } from '../../services/order';
import { Order, OrderStats } from '../../models/order';

interface RiderRoute {
  id: string;
  name: string;
  phone: string;
  plateNumber: string;
  color: string;
  zone: string;
  totalBoxes: number;
  maxBoxes: number;
  totalDistanceKm: number;
  estimatedTime: string;
  orders: Order[];
}

@Component({
  selector: 'app-route-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, Sidebar],
  templateUrl: './route_dashboard.html',
  styleUrl: './route_dashboard.css',
})
export class RouteDashboard implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);

  readonly DEPOT = {
    lat: 16.2468,
    lng: 103.2520,
    name: 'ศูนย์กระจายอาหารกลางวัน ม.มหาสารคาม',
  };

  jobId: string | null = null;
  currentTime = '';
  private timerInterval: any;

  riders: RiderRoute[] = [];
  totalBoxesRouted = 0;
  totalFleetDistanceKm = 10.3;
  isPrintModalOpen = false;

  private map: L.Map | null = null;
  private routeLayers: L.LayerGroup | null = null;

  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);

    this.route.queryParamMap.subscribe((params) => {
      this.jobId = params.get('jobId') || 'JOB-' + Math.floor(100000 + Math.random() * 900000);
      this.loadRoutingData();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initRouteMap();
    }, 250);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
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

  loadRoutingData(): void {
    this.orderService.getOrders().subscribe({
      next: (orders) => {
        this.clusterOrdersToRiders(orders);
        this.renderRoutesOnMap();
      },
      error: () => {
        // Fallback default sample orders
        this.clusterOrdersToRiders([]);
        this.renderRoutesOnMap();
      },
    });
  }

  private clusterOrdersToRiders(orders: Order[]): void {
    // If no orders loaded, provide fallback realistic sample data
    let activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
    if (activeOrders.length === 0) {
      activeOrders = [
        { id: '1', customer_name: 'คุณกิตติศักดิ์ (ตักศิลา)', phone: '089-123-4567', latitude: 16.2482, longitude: 103.2541, box_quantity: 2, status: 'ROUTING', created_at: '' },
        { id: '2', customer_name: 'คุณธีรภัทร (ซอยลีลา)', phone: '094-555-8812', latitude: 16.2515, longitude: 103.2560, box_quantity: 3, status: 'ROUTING', created_at: '' },
        { id: '3', customer_name: 'คุณนภัสสร (คณะ IT)', phone: '081-987-6543', latitude: 16.2449, longitude: 103.2498, box_quantity: 2, status: 'ROUTING', created_at: '' },
        { id: '4', customer_name: 'คุณพิมลวรรณ (ตลาดน้อย)', phone: '086-444-2390', latitude: 16.2435, longitude: 103.2510, box_quantity: 2, status: 'ROUTING', created_at: '' },
        { id: '5', customer_name: 'คุณอภิสิทธิ์ (อินเตอร์)', phone: '092-333-9182', latitude: 16.2530, longitude: 103.2475, box_quantity: 3, status: 'ROUTING', created_at: '' },
        { id: '6', customer_name: 'คุณชลธิชา (กัลปพฤกษ์)', phone: '085-777-3321', latitude: 16.2410, longitude: 103.2555, box_quantity: 2, status: 'ROUTING', created_at: '' },
        { id: '7', customer_name: 'คุณสมศรี มหาสารคาม', phone: '089-111-2233', latitude: 16.2450, longitude: 103.2515, box_quantity: 2, status: 'ROUTING', created_at: '' },
        { id: '8', customer_name: 'คุณมานี ศรีสวัสดิ์', phone: '081-234-5678', latitude: 16.2475, longitude: 103.2535, box_quantity: 1, status: 'ROUTING', created_at: '' },
      ];
    }

    const riderTemplates = [
      { id: 'R1', name: 'ไรเดอร์ 01 (สมชาย)', phone: '081-555-0101', plateNumber: '1กข-4452', color: '#EA580C', zone: 'หอพักตักศิลา - ซอยลีลา', estimatedTime: '11:50 น.' },
      { id: 'R2', name: 'ไรเดอร์ 02 (วิชัย)', phone: '089-666-0202', plateNumber: '2กง-8821', color: '#4F46E5', zone: 'คณะ IT - ตลาดน้อย มมส.', estimatedTime: '11:45 น.' },
      { id: 'R3', name: 'ไรเดอร์ 03 (อนุชา)', phone: '086-777-0303', plateNumber: '3คข-1190', color: '#9333EA', zone: 'อินเตอร์แมนชั่น - กัลปพฤกษ์', estimatedTime: '11:58 น.' },
    ];

    const resultRiders: RiderRoute[] = riderTemplates.map((t) => ({
      ...t,
      totalBoxes: 0,
      maxBoxes: 10,
      totalDistanceKm: 0,
      orders: [],
    }));

    // Partition orders respecting the 10 box limit
    let currentRiderIdx = 0;
    for (const order of activeOrders) {
      let r = resultRiders[currentRiderIdx];
      if (r.totalBoxes + order.box_quantity > r.maxBoxes) {
        if (currentRiderIdx < resultRiders.length - 1) {
          currentRiderIdx++;
          r = resultRiders[currentRiderIdx];
        }
      }
      r.orders.push(order);
      r.totalBoxes += order.box_quantity;
    }

    this.riders = resultRiders;
    this.totalBoxesRouted = resultRiders.reduce((s, r) => s + r.totalBoxes, 0);
  }

  private initRouteMap(): void {
    const el = document.getElementById('routeMap');
    if (!el || this.map) return;

    this.map = L.map('routeMap', {
      center: [this.DEPOT.lat, this.DEPOT.lng],
      zoom: 15,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    // MSU Central Depot Marker
    const depotIcon = L.divIcon({
      className: 'depot-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full bg-orange-500/30 animate-ping"></span>
          <div class="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
            🍱
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    L.marker([this.DEPOT.lat, this.DEPOT.lng], { icon: depotIcon })
      .bindPopup(`<div class="p-2 font-bold text-xs">🏢 ${this.DEPOT.name} (ศูนย์ต้นทาง)</div>`)
      .addTo(this.map);

    this.routeLayers = L.layerGroup().addTo(this.map);
    this.renderRoutesOnMap();
  }

  private renderRoutesOnMap(): void {
    if (!this.map || !this.routeLayers) return;
    this.routeLayers.clearLayers();

    for (const rider of this.riders) {
      if (rider.orders.length === 0) continue;

      const pathCoords: [number, number][] = [
        [this.DEPOT.lat, this.DEPOT.lng],
        ...rider.orders.map((o) => [o.latitude, o.longitude] as [number, number]),
      ];

      // Polyline route
      L.polyline(pathCoords, {
        color: rider.color,
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 6',
      }).addTo(this.routeLayers);

      // Order stops markers
      rider.orders.forEach((order, sIdx) => {
        const stopIcon = L.divIcon({
          className: 'stop-pin',
          html: `
            <div class="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs border border-white shadow-md font-mono" style="background-color: ${rider.color}">
              ${sIdx + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        L.marker([order.latitude, order.longitude], { icon: stopIcon })
          .bindPopup(`
            <div class="p-2.5 text-xs">
              <div class="font-bold text-slate-900">${order.customer_name}</div>
              <div class="text-slate-500 font-mono">📞 ${order.phone}</div>
              <div class="text-orange-600 font-bold mt-1">🍱 ${order.box_quantity} กล่อง</div>
              <div class="text-slate-400 text-[10px] mt-1">ไรเดอร์: ${rider.name} (ลำดับที่ ${sIdx + 1})</div>
            </div>
          `)
          .addTo(this.routeLayers!);
      });
    }
  }

  focusRider(rider: RiderRoute): void {
    if (!this.map || rider.orders.length === 0) return;
    const group = L.featureGroup(
      rider.orders.map((o) => L.marker([o.latitude, o.longitude]))
    );
    this.map.fitBounds(group.getBounds().pad(0.2));
  }

  printAllManifests(): void {
    this.isPrintModalOpen = true;
  }

  confirmPrint(): void {
    window.print();
  }
}

