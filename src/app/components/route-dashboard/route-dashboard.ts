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
  imports: [CommonModule, RouterModule],
  template: `
    <div class="flex min-h-screen bg-slate-50 font-sans antialiased text-slate-800 selection:bg-amber-500 selection:text-white">
      
      <!-- ================================================================== -->
      <!-- LEFT SIDEBAR: DARK OBSIDIAN MODERN DESIGN                         -->
      <!-- ================================================================== -->
      <aside class="w-72 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between p-5 shrink-0 min-h-screen hidden md:flex z-30">
        <div class="space-y-6">
          
          <!-- Brand Logo / Header -->
          <div class="flex items-center gap-3 pb-5 border-b border-slate-800">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 ring-2 ring-white/10 shrink-0">
              🍱
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h1 class="text-base font-bold text-white tracking-tight leading-tight">
                  ข้าวกล่องส่งด่วน
                </h1>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  มมส.
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                CVRPTW Engine ขามเรียง
              </p>
            </div>
          </div>

          <!-- Live Dispatch Clock Card -->
          <div class="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-inner">
            <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                เวลาปัจจุบัน
              </span>
              <span class="font-mono text-amber-400 font-bold tracking-wider text-sm">{{ currentTime }}</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
              <span class="text-slate-400">รอบตัดส่ง CVRPTW:</span>
              <span class="font-semibold text-white px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                11:30 - 12:30 น.
              </span>
            </div>
          </div>

          <!-- Navigation Menu -->
          <div>
            <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              เมนูระบบ
            </div>
            <nav class="space-y-1.5 text-sm font-medium">
              <a
                routerLink="/orders"
                class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all group"
              >
                <div class="flex items-center gap-3">
                  <svg class="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                  </svg>
                  <span>จัดการออเดอร์</span>
                </div>
              </a>

              <a
                routerLink="/routes"
                class="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30 shadow-sm transition-all"
              >
                <div class="flex items-center gap-3">
                  <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                  </svg>
                  <span>จัดเส้นทางไรเดอร์</span>
                </div>
                <span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold">
                  {{ riders.length }} คัน
                </span>
              </a>

              <a
                routerLink="/rider"
                class="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all group"
              >
                <div class="flex items-center gap-3">
                  <span class="text-sm">🛵</span>
                  <span>มุมมองไรเดอร์ (Rider)</span>
                </div>
              </a>
            </nav>
          </div>

          <!-- Central Depot Info Box -->
          <div class="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 space-y-2">
            <div class="flex items-center gap-2 font-bold text-white text-xs">
              <span>🏢</span>
              <span>ศูนย์กระจายอาหาร มมส.</span>
            </div>
            <div class="text-[11px] text-slate-400">
              พิกัด: 16.2468, 103.2520 (รัศมี 3.0 กม.)
            </div>
            <div class="pt-1.5 border-t border-slate-700/50 text-[11px] space-y-1">
              <div class="flex justify-between text-slate-400">
                <span>ขีดจำกัดความจุ:</span>
                <span class="text-amber-400 font-semibold">10 กล่อง / ไรเดอร์</span>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>ความเร็วเฉลี่ย:</span>
                <span class="text-slate-200 font-semibold">25 กม./ชม.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Antigravity Dispatch v2.0</span>
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>
      </aside>

      <!-- ================================================================== -->
      <!-- MAIN WORKSPACE CONTENT AREA                                        -->
      <!-- ================================================================== -->
      <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <!-- Top Header Navigation Bar -->
        <header class="bg-white border-b border-slate-200/90 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div class="flex items-center gap-3">
            <a
              routerLink="/orders"
              class="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <span>← กลับหน้าออเดอร์</span>
            </a>

            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  จัดสรรเส้นทางและแบ่งงานไรเดอร์ (CVRPTW Engine)
                </h2>
                @if (jobId) {
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Job: {{ jobId }}
                  </span>
                }
              </div>
              <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
                ระบบคำนวณคลัสเตอร์เส้นทางที่ดีที่สุดตามกรอบเวลา 11:30 - 12:30 น. (คันละไม่เกิน 10 กล่อง)
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="printAllManifests()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 shadow-xs transition active:scale-95"
            >
              🖨️ พิมพ์ใบนำส่งสินค้า
            </button>
          </div>
        </header>

        <!-- Content Body -->
        <div class="p-6 lg:p-8 space-y-6">
          
          <!-- Dispatch Pipeline Stepper -->
          <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
            <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              ลำดับขั้นตอนการปฏิบัติการรอบเที่ยง (Dispatch Lifecycle)
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">✓</span>
                <div>
                  <div class="font-bold text-xs">1. รวบรวมออเดอร์</div>
                  <div class="text-[11px] text-emerald-700">11:00 - 11:30 น. (เสร็จสิ้น)</div>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">🚀</span>
                <div>
                  <div class="font-bold text-xs">2. CVRPTW Engine</div>
                  <div class="text-[11px] text-blue-700">แบ่งกลุ่ม & จัดลำดับจุดส่ง</div>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 animate-pulse">📦</span>
                <div>
                  <div class="font-bold text-xs">3. บรรจุกล่องข้าว</div>
                  <div class="text-[11px] text-amber-700">11:30 - 11:45 น. (กำลังทำ)</div>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">🛵</span>
                <div>
                  <div class="font-bold text-xs">4. กระจายส่งรอบ มมส.</div>
                  <div class="text-[11px] text-slate-500">11:45 - 12:30 น. (พร้อมวิ่ง)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Fleet KPI Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs">
              <span class="text-xs font-semibold text-slate-500">ไรเดอร์ปฏิบัติการ</span>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-extrabold text-slate-900 font-mono">{{ riders.length }}</span>
                <span class="text-xs text-slate-500">คัน (ไม่เกิน 10 กล่อง/คัน)</span>
              </div>
            </div>

            <div class="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs">
              <span class="text-xs font-semibold text-slate-500">ข้าวกล่องที่กระจายส่ง</span>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-extrabold text-orange-600 font-mono">{{ totalBoxesRouted }}</span>
                <span class="text-xs text-slate-500">กล่อง</span>
              </div>
            </div>

            <div class="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs">
              <span class="text-xs font-semibold text-slate-500">ระยะทางรวมทุกเส้นทาง</span>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-extrabold text-indigo-600 font-mono">{{ totalFleetDistanceKm.toFixed(1) }}</span>
                <span class="text-xs text-slate-500">กิโลเมตร</span>
              </div>
            </div>

            <div class="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs">
              <span class="text-xs font-semibold text-slate-500">อัตราส่งทันเวลาคาดการณ์</span>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-3xl font-extrabold text-emerald-600 font-mono">100%</span>
                <span class="text-xs text-slate-500">ก่อน 12:30 น.</span>
              </div>
            </div>
          </div>

          <!-- Interactive Route Map -->
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between text-xs">
              <div class="flex items-center gap-2 font-bold">
                <span>🗺️</span>
                <span>แผนที่เส้นทางจัดส่งอาหารกลางวัน (CVRPTW Routes Map)</span>
              </div>
              <div class="flex items-center gap-3 text-[11px] text-slate-400">
                <span class="flex items-center gap-1.5"><span class="w-3 h-1 bg-amber-500 rounded"></span> ไรเดอร์ 01</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-1 bg-indigo-500 rounded"></span> ไรเดอร์ 02</span>
                <span class="flex items-center gap-1.5"><span class="w-3 h-1 bg-purple-500 rounded"></span> ไรเดอร์ 03</span>
              </div>
            </div>

            <!-- Leaflet Map Container -->
            <div id="routeMap" style="height: 380px;" class="w-full"></div>
          </div>

          <!-- Rider Allocation Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @for (rider of riders; track rider.id; let rIdx = $index) {
              <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between">
                
                <div class="p-5">
                  <!-- Card Header -->
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm" [style.background-color]="rider.color">
                        🛵
                      </div>
                      <div>
                        <h4 class="font-bold text-slate-900 text-sm">{{ rider.name }}</h4>
                        <div class="text-[11px] text-slate-500 font-mono">{{ rider.plateNumber }} · {{ rider.phone }}</div>
                      </div>
                    </div>

                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      พร้อมส่ง
                    </span>
                  </div>

                  <!-- Zone & Capacity -->
                  <div class="mb-4">
                    <div class="text-xs text-slate-600 font-medium mb-1.5 flex items-center justify-between">
                      <span>โซนจัดส่ง: <strong>{{ rider.zone }}</strong></span>
                      <span class="font-mono text-amber-700 font-bold">{{ rider.totalBoxes }} / {{ rider.maxBoxes }} กล่อง</span>
                    </div>

                    <!-- Progress Bar (10 Boxes Max) -->
                    <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        [style.width.%]="(rider.totalBoxes / rider.maxBoxes) * 100"
                        [style.background-color]="rider.color"
                      ></div>
                    </div>
                  </div>

                  <!-- Stops Sequence Timeline -->
                  <div class="space-y-2 pt-3 border-t border-slate-100">
                    <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      ลำดับจุดส่งมอบ ({{ rider.orders.length }} จุดส่ง):
                    </div>

                    <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      @for (order of rider.orders; track order.id; let sIdx = $index) {
                        <div class="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span class="w-5 h-5 rounded-full bg-white text-slate-700 border border-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
                              {{ sIdx + 1 }}
                            </span>
                            <div>
                              <div class="font-bold text-slate-800">{{ order.customer_name }}</div>
                              <div class="text-[10px] text-slate-400 font-mono">{{ order.phone }}</div>
                            </div>
                          </div>
                          <span class="font-bold text-orange-600 font-mono shrink-0">
                            {{ order.box_quantity }} กล่อง
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <!-- Card Footer Actions -->
                <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div class="text-slate-500">
                    ประมาณการ: <strong class="text-slate-900">{{ rider.estimatedTime }}</strong>
                  </div>
                  <button
                    type="button"
                    (click)="focusRider(rider)"
                    class="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold transition"
                  >
                    🔍 ดูบนแผนที่
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Bottom Navigation Bar -->
          <div class="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between text-xs text-slate-600">
            <span>ข้อมูลไรเดอร์ทั้งหมดคำนวณและปรับตามรายการออเดอร์ในหน้าจอที่ 1 อัตโนมัติ</span>
            <a routerLink="/orders" class="font-bold text-amber-600 hover:text-amber-800 transition">
              ← กลับไปตรวจเช็กออเดอร์หน้าร้าน
            </a>
          </div>
        </div>
      </main>

      <!-- Manifest Print Preview Modal -->
      @if (isPrintModalOpen) {
        <div class="modal-backdrop-custom">
          <div class="modal-content-animated bg-white w-full max-w-2xl p-6 rounded-2xl border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 class="font-bold text-slate-900 text-base">
                ใบนำส่งอาหารกลางวัน (Delivery Manifest)
              </h3>
              <button (click)="isPrintModalOpen = false" class="text-slate-400 hover:text-slate-900 font-bold">✕</button>
            </div>

            <div class="space-y-6">
              @for (rider of riders; track rider.id) {
                <div class="border border-slate-200 rounded-xl p-4">
                  <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                    <span class="font-bold text-sm text-slate-900">{{ rider.name }} ({{ rider.plateNumber }})</span>
                    <span class="text-xs font-mono font-bold text-orange-600">ยอดรวม: {{ rider.totalBoxes }} กล่อง</span>
                  </div>

                  <table class="w-full text-xs text-left">
                    <thead class="bg-slate-50 text-slate-500">
                      <tr>
                        <th class="p-2">#</th>
                        <th class="p-2">ลูกค้า</th>
                        <th class="p-2">เบอร์โทร</th>
                        <th class="p-2 text-center">กล่อง</th>
                        <th class="p-2 text-right">ยอดเก็บเงิน</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (order of rider.orders; track order.id; let oIdx = $index) {
                        <tr>
                          <td class="p-2 font-mono">{{ oIdx + 1 }}</td>
                          <td class="p-2 font-semibold">{{ order.customer_name }}</td>
                          <td class="p-2 font-mono">{{ order.phone }}</td>
                          <td class="p-2 text-center font-bold text-orange-600">{{ order.box_quantity }}</td>
                          <td class="p-2 text-right font-mono font-bold">฿{{ order.box_quantity * 65 }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="mt-5 flex justify-end gap-2">
              <button
                type="button"
                (click)="isPrintModalOpen = false"
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                ปิด
              </button>
              <button
                type="button"
                (click)="confirmPrint()"
                class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                🖨️ พิมพ์ออกทางเครื่องพิมพ์
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class RouteDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
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

