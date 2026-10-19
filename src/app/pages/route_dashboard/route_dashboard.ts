import { Sidebar } from '../../components/sidebar/sidebar';
import { Component, OnInit, AfterViewInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import * as L from 'leaflet';
import { OrderService } from '../../services/order';
import { Order, OrderStatus } from '../../models/order';

const API_URL = 'https://back-n-web2.vercel.app';



interface delivery_task_route {
  id: string;
  name: string;
  color: string;
  //zone: string;
  totalBoxes: number;
  maxBoxes: number;
  totalDistanceKm: number;
  estimatedTime: string;
  isLate: boolean;   // true = ถึงจุดสุดท้ายเกิน 12:30
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
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  // เงื่อนไขจากเอกสาร: ไรเดอร์ 1 คน รับไม่เกิน 3 ออเดอร์
  MAX_ORDERS_PER_TASK = 3;

  // สีเส้นทางของไรเดอร์แต่ละคน (คนที่ 1 แดง, 2 เขียว, 3 น้ำเงิน, ...)
  ROUTE_COLORS = ['#EF4444', '#16A34A', '#2563EB', '#EA580C', '#9333EA', '#0891B2', '#DB2777', '#CA8A04'];
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

  // จุดเริ่ม = ร้าน (เหมือน start_point ใน backend)
  start_point = {
    lat: 16.2468,
    lng: 103.2520,
    name: 'ศูนย์กระจายอาหารกลางวัน ม.มหาสารคาม',
  };

  jobId: string | null = null;
  currentTime = '';
  private timerInterval: any;

  delivery_tasks: delivery_task_route[] = [];
  totalBoxesRouted = 0;
  totalFleetDistanceKm = 0;
  isPrintModalOpen = false;

  private map: L.Map | null = null;
  private routeLayers: L.LayerGroup | null = null;
  // คำนวณกำไรและค่าใช้จ่ายของไรเดอร์หนึ่งคน
  getFoodProfit(delivery_task: delivery_task_route): number {
    return delivery_task.totalBoxes * (65 - 40);
  }

  getTaskCost(delivery_task: delivery_task_route): number {
    if (delivery_task.orders.length === 0) return 0;

    const pickupFee = 15;
    const deliveryCost = delivery_task.totalDistanceKm * delivery_task.totalBoxes * 2;

    return pickupFee + deliveryCost;
  }

  getNetProfit(delivery_task: delivery_task_route): number {
    return this.getFoodProfit(delivery_task) - this.getTaskCost(delivery_task);
  }
  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);

    this.route.queryParamMap.subscribe((params) => {
      this.jobId = params.get('jobId') || 'JOB-' + Math.floor(100000 + Math.random() * 900000);
      this.load_routing_data();
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

  // ดึงใบงานของวันนี้จาก database backend จัดเส้นทางไว้แล้วตอนกดปุ่ม "จัดเส้นทาง"
  //GET /api/delivery_tasks    ใบงานทั้งหมด
  //GET /api/delivery_tasks/:task_number จุดส่งของแต่ละใบ 
  load_routing_data(): void {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // เช่น 20261019

    this.http.get<any[]>(`${API_URL}/api/delivery_tasks`).subscribe({
      next: (tasks) => {
        // เอาเฉพาะใบงานของวันนี้
        const today_tasks = tasks.filter((t) => t.task_number.startsWith(`TASK-${today}`));

        if (today_tasks.length === 0) {
          this.show_tasks([]);
          return;
        }

        // ดึงจุดส่งของทุกใบพร้อมกัน แล้วรอให้ครบทุกใบ (forkJoin)
        const requests = today_tasks.map((t) => this.http.get<any>(`${API_URL}/api/delivery_tasks/${t.task_number}`));
        forkJoin(requests).subscribe({
          next: (details) => this.show_tasks(details.map((d) => this.to_task_route(d))),
          error: () => this.show_tasks([]),
        });
      },
      error: () => this.show_tasks([]),
    });
  }

  // แปลงใบงานจาก backend ให้เป็นหน้าตาที่หน้านี้ใช้ (delivery_task_route)
  private to_task_route(task: any): delivery_task_route {
    return {
      id: task.task_number,
      name: task.task_number,
      color: task.route_color,
      totalBoxes: task.total_boxes,
      maxBoxes: 9,                                       // 3 ออเดอร์ × สูงสุด 3 กล่อง
      totalDistanceKm: task.total_distance,
      estimatedTime: `${task.estimated_minutes} นาที`,   // เวลาที่ใช้ส่ง (backend คำนวณ)
      isLate: task.items.some((item: any) => item.delivery_status === 'LATE'),
      orders: task.items.map((item: any) => ({
        id: String(item.order_id),
        customer_name: item.customer_name,
        phone: item.phone,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        box_quantity: item.box_amount,
        status: (item.delivery_status === 'PENDING' ? 'ASSIGNED' : 'COMPLETED') as OrderStatus,
        created_at: '',
      })),
    };
  }

  // เอาใบงานไปแสดง + วาดบนแผนที่
  private show_tasks(tasks: delivery_task_route[]): void {
    this.delivery_tasks = tasks.sort((a, b) => a.name.localeCompare(b.name)); // TASK-...-01, 02, 03
    this.totalBoxesRouted = tasks.reduce((sum, t) => sum + t.totalBoxes, 0);
    this.totalFleetDistanceKm = tasks.reduce((sum, t) => sum + t.totalDistanceKm, 0);
    this.renderRoutesOnMap();
    this.cdr.markForCheck();
  }

  private initRouteMap(): void {
    const el = document.getElementById('routeMap');
    if (!el || this.map) return;

    this.map = L.map('routeMap', {
      center: [this.start_point.lat, this.start_point.lng],
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
            <span class="icon" aria-hidden="true">bento</span>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    L.marker([this.start_point.lat, this.start_point.lng], { icon: depotIcon })
      .bindPopup(`<div class="p-2 font-bold text-xs"><span class="icon" aria-hidden="true">warehouse</span> ${this.start_point.name} (ศูนย์ต้นทาง)</div>`)
      .addTo(this.map);

    this.routeLayers = L.layerGroup().addTo(this.map);
    this.renderRoutesOnMap();
  }

  private renderRoutesOnMap(): void {
    if (!this.map || !this.routeLayers) return;
    this.routeLayers.clearLayers();

    for (const delivery_task of this.delivery_tasks) {
      if (delivery_task.orders.length === 0) continue;

      const pathCoords: [number, number][] = [
        [this.start_point.lat, this.start_point.lng],
        ...delivery_task.orders.map((o) => [o.latitude, o.longitude] as [number, number]),
      ];

      // Polyline route
      L.polyline(pathCoords, {
        color: delivery_task.color,
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 6',
      }).addTo(this.routeLayers);

      // Order stops markers
      delivery_task.orders.forEach((order, sIdx) => {
        const stopIcon = L.divIcon({
          className: 'stop-pin',
          html: `
            <div class="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs border border-white shadow-md font-mono" style="background-color: ${delivery_task.color}">
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
              <div class="text-slate-500 font-mono"><span class="icon" aria-hidden="true">call</span> ${order.phone}</div>
              <div class="text-orange-600 font-bold mt-1"><span class="icon" aria-hidden="true">bento</span> ${order.box_quantity} กล่อง</div>
              <div class="text-slate-400 text-[10px] mt-1">ไรเดอร์: ${delivery_task.name} (ลำดับที่ ${sIdx + 1})</div>
            </div>
          `)
          .addTo(this.routeLayers!);
      });
    }
  }

  focusDeliveryTask(delivery_task: delivery_task_route): void {
    if (!this.map || delivery_task.orders.length === 0) return;
    const group = L.featureGroup(
      delivery_task.orders.map((o) => L.marker([o.latitude, o.longitude]))
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

//////เก่า


// interface delivery_taskRoute {
//   id: string;
//   name: string;
//   color: string;
//   //zone: string;
//   totalBoxes: number;
//   maxBoxes: number;
//   totalDistanceKm: number;
//   estimatedTime: string;
//   isLate: boolean;   // true = ถึงจุดสุดท้ายเกิน 12:30
//   orders: Order[];
// }

// @Component({
//   selector: 'app-route-dashboard',
//   standalone: true,
//   imports: [CommonModule, RouterModule, Sidebar],
//   templateUrl: './route_dashboard.html',
//   styleUrl: './route_dashboard.css',
// })
// export class RouteDashboard implements OnInit, AfterViewInit, OnDestroy {
//   private route = inject(ActivatedRoute);
//   private orderService = inject(OrderService);

// //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   // เงื่อนไขจากเอกสาร: ไรเดอร์ 1 คน รับไม่เกิน 3 ออเดอร์
//   readonly MAX_ORDERS_PER_delivery_task = 3;

//   // สีเส้นทางของไรเดอร์แต่ละคน (คนที่ 1 แดง, 2 เขียว, 3 น้ำเงิน, ...)
//   readonly ROUTE_COLORS = ['#EF4444', '#16A34A', '#2563EB', '#EA580C', '#9333EA', '#0891B2', '#DB2777', '#CA8A04'];
// //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//   readonly DEPOT = {
//     lat: 16.2468,
//     lng: 103.2520,
//     name: 'ศูนย์กระจายอาหารกลางวัน ม.มหาสารคาม',
//   };

//   jobId: string | null = null;
//   currentTime = '';
//   private timerInterval: any;

//   delivery_tasks: delivery_taskRoute[] = [];
//   totalBoxesRouted = 0;
//   totalFleetDistanceKm = 10.3;
//   isPrintModalOpen = false;

//   private map: L.Map | null = null;
//   private routeLayers: L.LayerGroup | null = null;
//   // คำนวณกำไรและค่าใช้จ่ายของไรเดอร์หนึ่งคน
//   getFoodProfit(delivery_task: delivery_taskRoute): number {
//     return delivery_task.totalBoxes * (65 - 40);
//   }

//   getdelivery_taskCost(delivery_task: delivery_taskRoute): number {
//     if (delivery_task.orders.length === 0) return 0;

//     const pickupFee = 15;
//     const deliveryCost = delivery_task.totalDistanceKm * delivery_task.totalBoxes * 2;

//     return pickupFee + deliveryCost;
//   }

//   getNetProfit(delivery_task: delivery_taskRoute): number {
//     return this.getFoodProfit(delivery_task) - this.getdelivery_taskCost(delivery_task);
//   }
//     private distanceKm(
//     lat1: number,
//     lng1: number,
//     lat2: number,
//     lng2: number
//   ): number {
//     const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
//     const earthRadiusKm = 6371;

//     const dLat = toRadians(lat2 - lat1);
//     const dLng = toRadians(lng2 - lng1);
//     const startLat = toRadians(lat1);
//     const endLat = toRadians(lat2);

//     const a =
//       Math.sin(dLat / 2) ** 2 +
//       Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;

//     return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   }

//   private calculatedelivery_taskDistance(delivery_task: delivery_taskRoute): number {
//     let totalDistanceKm = 0;
//     let fromLat = this.start_point.lat;
//     let fromLng = this.start_point.lng;

//     for (const order of delivery_task.orders) {
//       totalDistanceKm += this.distanceKm(
//         fromLat,
//         fromLng,
//         order.latitude,
//         order.longitude
//       );

//       fromLat = order.latitude;
//       fromLng = order.longitude;
//     }

//     return Number(totalDistanceKm.toFixed(2));
//   }
//   ngOnInit(): void {
//     this.updateClock();
//     this.timerInterval = setInterval(() => this.updateClock(), 1000);

//     this.route.queryParamMap.subscribe((params) => {
//       this.jobId = params.get('jobId') || 'JOB-' + Math.floor(100000 + Math.random() * 900000);
//       this.loadRoutingData();
//     });
//   }

//   ngAfterViewInit(): void {
//     setTimeout(() => {
//       this.initRouteMap();
//     }, 250);
//   }

//   ngOnDestroy(): void {
//     if (this.timerInterval) clearInterval(this.timerInterval);
//     if (this.map) {
//       this.map.remove();
//       this.map = null;
//     }
//   }

//   private updateClock(): void {
//     const now = new Date();
//     this.currentTime = now.toLocaleTimeString('th-TH', {
//       hour: '2-digit',
//       minute: '2-digit',
//       second: '2-digit',
//     });
//   }

//   loadRoutingData(): void {
//     this.orderService.getOrders().subscribe({
//       next: (orders) => {
//         this.clusterOrdersTodelivery_tasks(orders);
//         this.renderRoutesOnMap();
//       },
//       error: () => {
//         // Fallback default sample orders
//         this.clusterOrdersTodelivery_tasks([]);
//         this.renderRoutesOnMap();
//       },
//     });
//   }

//   private clusterOrdersTodelivery_tasks(orders: Order[]): void {
//     // If no orders loaded, provide fallback realistic sample data
//     let activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
//     if (activeOrders.length === 0) {
//       activeOrders = [
//         { id: '1', customer_name: 'คุณกิตติศักดิ์ (ตักศิลา)', phone: '089-123-4567', latitude: 16.2482, longitude: 103.2541, box_quantity: 2, status: 'ROUTING', created_at: '' },
//         { id: '2', customer_name: 'คุณธีรภัทร (ซอยลีลา)', phone: '094-555-8812', latitude: 16.2515, longitude: 103.2560, box_quantity: 3, status: 'ROUTING', created_at: '' },
//         { id: '3', customer_name: 'คุณนภัสสร (คณะ IT)', phone: '081-987-6543', latitude: 16.2449, longitude: 103.2498, box_quantity: 2, status: 'ROUTING', created_at: '' },
//         { id: '4', customer_name: 'คุณพิมลวรรณ (ตลาดน้อย)', phone: '086-444-2390', latitude: 16.2435, longitude: 103.2510, box_quantity: 2, status: 'ROUTING', created_at: '' },
//         { id: '5', customer_name: 'คุณอภิสิทธิ์ (อินเตอร์)', phone: '092-333-9182', latitude: 16.2530, longitude: 103.2475, box_quantity: 3, status: 'ROUTING', created_at: '' },
//         { id: '6', customer_name: 'คุณชลธิชา (กัลปพฤกษ์)', phone: '085-777-3321', latitude: 16.2410, longitude: 103.2555, box_quantity: 2, status: 'ROUTING', created_at: '' },
//         { id: '7', customer_name: 'คุณสมศรี มหาสารคาม', phone: '089-111-2233', latitude: 16.2450, longitude: 103.2515, box_quantity: 2, status: 'ROUTING', created_at: '' },
//         { id: '8', customer_name: 'คุณมานี ศรีสวัสดิ์', phone: '081-234-5678', latitude: 16.2475, longitude: 103.2535, box_quantity: 1, status: 'ROUTING', created_at: '' },
//       ];
//     }

//     // const delivery_taskTemplates = [
//     //   { id: 'R1', name: 'ไรเดอร์ 01 (สมชาย)', color: '#EA580C', zone: 'หอพักตักศิลา - ซอยลีลา', estimatedTime: '11:50 น.' },
//     //   { id: 'R2', name: 'ไรเดอร์ 02 (วิชัย)', color: '#4F46E5', zone: 'คณะ IT - ตลาดน้อย มมส.', estimatedTime: '11:45 น.' },
//     //   { id: 'R3', name: 'ไรเดอร์ 03 (อนุชา)', color: '#9333EA', zone: 'อินเตอร์แมนชั่น - กัลปพฤกษ์', estimatedTime: '11:58 น.' },
//     // ];

//     // const resultdelivery_tasks: delivery_taskRoute[] = delivery_taskTemplates.map((t) => ({
//     //   ...t,
//     //   totalBoxes: 0,
//     //   maxBoxes: 9,   // 1 order 3 กล่อง | 3 order 9 กล่อง
//     //   totalDistanceKm: 0,
//     //   isLate: false,   // ยังไม่ late
//     //   orders: [],
//     // }));

//     // //9 box limit
//     // let currentdelivery_taskIdx = 0;
//     // for (const order of activeOrders) {
//     //   let r = resultdelivery_tasks[currentdelivery_taskIdx];
//     //   if (r.orders.length >= 3 || r.totalBoxes + order.box_quantity > r.maxBoxes) { //ถ้าไรเดอร์คนนี้มีครบ 3 ออเดอร์แล้ว หรือ ถ้ารับออเดอร์นี้เพิ่มแล้วกล่องจะเกิน 9 ใบ ให้ส่งออเดอร์ไปให้ไรเดอร์คนถัดไป
//     //     if (currentdelivery_taskIdx < resultdelivery_tasks.length - 1) {
//     //       currentdelivery_taskIdx++;
//     //       r = resultdelivery_tasks[currentdelivery_taskIdx];
//     //     }
//     //   }
//     //   r.orders.push(order);
//     //   r.totalBoxes += order.box_quantity;
//     // }

    

//     //ปปปปปxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//     // จำนวนใบงาน = จำนวนออเดอร์ ÷ 3 แล้วปัดขึ้น (ใบละไม่เกิน 3 ออเดอร์)
//     const taskCount = Math.ceil(activeOrders.length / this.MAX_ORDERS_PER_delivery_task);

//     // วันที่วันนี้ เช่น 20261018 ใช้ทำเลขใบงาน
//     const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

//     const resultdelivery_tasks: delivery_taskRoute[] = [];
//     for (let i = 0; i < taskCount; i++) {
//       const taskNumber = `TASK-${today}-${String(i + 1).padStart(2, '0')}`;
//       resultdelivery_tasks.push({
//         id: taskNumber,
//         name: taskNumber,                 // = task_number ใน delivery_tasks
//         color: this.ROUTE_COLORS[i % this.ROUTE_COLORS.length],
//         totalBoxes: 0,
//         maxBoxes: 9,                      // 3 ออเดอร์ × สูงสุด 3 กล่อง
//         totalDistanceKm: 0,
//         estimatedTime: '-',
//         isLate: false,
//         orders: [],
//       });
//     }

//     // ใส่ออเดอร์ลงใบงาน ใบละไม่เกิน 3 ออเดอร์
//     activeOrders.forEach((order, index) => {
//       const task = resultdelivery_tasks[Math.floor(index / this.MAX_ORDERS_PER_delivery_task)];
//       task.orders.push(order);
//       task.totalBoxes += order.box_quantity;
//     });
//     //******************* */
//     for (const delivery_task of resultdelivery_tasks) {
//       delivery_task.totalDistanceKm = this.calculatedelivery_taskDistance(delivery_task);
//     }
    
//     this.delivery_tasks = resultdelivery_tasks;
//     this.totalBoxesRouted = resultdelivery_tasks.reduce((s, r) => s + r.totalBoxes, 0);
//   }

//   private initRouteMap(): void {
//     const el = document.getElementById('routeMap');
//     if (!el || this.map) return;

//     this.map = L.map('routeMap', {
//       center: [this.start_point.lat, this.start_point.lng],
//       zoom: 15,
//       attributionControl: false,
//     });

//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       maxZoom: 19,
//     }).addTo(this.map);

//     // MSU Central Depot Marker
//     const depotIcon = L.divIcon({
//       className: 'depot-pin',
//       html: `
//         <div class="relative flex items-center justify-center">
//           <span class="absolute w-10 h-10 rounded-full bg-orange-500/30 animate-ping"></span>
//           <div class="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg border-2 border-white font-bold text-xs">
//             🍱
//           </div>
//         </div>
//       `,
//       iconSize: [36, 36],
//       iconAnchor: [18, 18],
//     });

//     L.marker([this.start_point.lat, this.start_point.lng], { icon: depotIcon })
//       .bindPopup(`<div class="p-2 font-bold text-xs">🏢 ${this.start_point.name} (ศูนย์ต้นทาง)</div>`)
//       .addTo(this.map);

//     this.routeLayers = L.layerGroup().addTo(this.map);
//     this.renderRoutesOnMap();
//   }

//   private renderRoutesOnMap(): void {
//     if (!this.map || !this.routeLayers) return;
//     this.routeLayers.clearLayers();

//     for (const delivery_task of this.delivery_tasks) {
//       if (delivery_task.orders.length === 0) continue;

//       const pathCoords: [number, number][] = [
//         [this.start_point.lat, this.start_point.lng],
//         ...delivery_task.orders.map((o) => [o.latitude, o.longitude] as [number, number]),
//       ];

//       // Polyline route
//       L.polyline(pathCoords, {
//         color: delivery_task.color,
//         weight: 4,
//         opacity: 0.8,
//         dashArray: '6, 6',
//       }).addTo(this.routeLayers);

//       // Order stops markers
//       delivery_task.orders.forEach((order, sIdx) => {
//         const stopIcon = L.divIcon({
//           className: 'stop-pin',
//           html: `
//             <div class="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs border border-white shadow-md font-mono" style="background-color: ${delivery_task.color}">
//               ${sIdx + 1}
//             </div>
//           `,
//           iconSize: [24, 24],
//           iconAnchor: [12, 12],
//         });

//         L.marker([order.latitude, order.longitude], { icon: stopIcon })
//           .bindPopup(`
//             <div class="p-2.5 text-xs">
//               <div class="font-bold text-slate-900">${order.customer_name}</div>
//               <div class="text-slate-500 font-mono">📞 ${order.phone}</div>
//               <div class="text-orange-600 font-bold mt-1">🍱 ${order.box_quantity} กล่อง</div>
//               <div class="text-slate-400 text-[10px] mt-1">ไรเดอร์: ${delivery_task.name} (ลำดับที่ ${sIdx + 1})</div>
//             </div>
//           `)
//           .addTo(this.routeLayers!);
//       });
//     }
//   }

//   focusdelivery_task(delivery_task: delivery_taskRoute): void {
//     if (!this.map || delivery_task.orders.length === 0) return;
//     const group = L.featureGroup(
//       delivery_task.orders.map((o) => L.marker([o.latitude, o.longitude]))
//     );
//     this.map.fitBounds(group.getBounds().pad(0.2));
//   }

//   printAllManifests(): void {
//     this.isPrintModalOpen = true;
//   }

//   confirmPrint(): void {
//     window.print();
//   }
// }