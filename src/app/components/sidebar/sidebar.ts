import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  icon: string; // ชื่อไอคอน Material Symbols
}

/**
 * Sidebar (navbar ด้านซ้าย) ที่ใช้ร่วมกันทุกหน้า
 * ใช้งาน: <app-sidebar [ordersBadge]="..." [routesBadge]="..." />
 * แก้เมนูที่เดียวใน navItems แล้วทุกหน้าจะเปลี่ยนตาม
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="w-72 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between p-5 shrink-0 min-h-screen hidden md:flex z-30">
      <div class="space-y-6">

        <!-- Brand -->
        <div class="flex items-center gap-3 pb-5 border-b border-slate-800">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 ring-2 ring-white/10 shrink-0 text-white"><span class="icon icon-fill" aria-hidden="true">bento</span></div>
          <div>
            <div class="flex items-center gap-1.5">
              <h1 class="text-base font-bold text-white tracking-tight leading-tight">ข้าวกล่องส่งด่วน</h1>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">มมส.</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">CVRPTW Engine ขามเรียง</p>
          </div>
        </div>

        <!-- Clock -->
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
            <span class="font-semibold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">{{ peakWindow }}</span>
          </div>
        </div>

        <!-- Menu -->
        <div>
          <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">เมนูระบบ</div>
          <nav class="space-y-1.5 text-sm font-medium">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-amber-500/15 !text-amber-400 font-semibold border-amber-500/30 shadow-sm"
                class="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-transparent text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <div class="flex items-center gap-3">
                  <span class="icon text-[20px]" aria-hidden="true">{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                </div>
                @if (badgeFor(item.path); as badge) {
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">{{ badge }}</span>
                }
              </a>
            }
          </nav>
        </div>

        <!-- Depot info -->
        <div class="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 space-y-2">
          <div class="flex items-center gap-2 font-bold text-white text-xs">
            <span class="icon text-amber-400" aria-hidden="true">warehouse</span><span>จุดกระจายอาหารกลางวัน</span>
          </div>
          <div class="text-[11px] text-slate-400">ม.มหาสารคาม (ขามเรียง)</div>
          <div class="pt-1.5 border-t border-slate-700/50 text-[11px] space-y-1">
            <div class="flex justify-between text-slate-400"><span>รัศมีบริการ:</span><span class="text-amber-400 font-semibold">≤ 3.0 กิโลเมตร</span></div>
            <div class="flex justify-between text-slate-400"><span>ความจุไรเดอร์:</span><span class="text-slate-200 font-semibold">10 กล่อง / คัน</span></div>
            <div class="flex justify-between text-slate-400"><span>ราคา / ต้นทุน:</span><span class="text-emerald-400 font-semibold">65฿ / 40฿ (กำไร 25฿)</span></div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
        
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      </div>
    </aside>
  `,
})
export class Sidebar implements OnInit, OnDestroy {
  /** ตัวเลขที่แสดงข้างเมนู (ไม่ส่งมา หรือเป็น 0 = ไม่แสดง) */
  @Input() ordersBadge: string | number | null = null;
  @Input() routesBadge: string | number | null = null;

  readonly peakWindow = '11:30 - 12:30 น.';

  readonly navItems: NavItem[] = [
    { path: '/orders', label: 'จัดการออเดอร์', icon: 'receipt_long' },
    { path: '/routes', label: 'จัดเส้นทางไรเดอร์', icon: 'route' },
    { path: '/customers', label: 'จัดการลูกค้า', icon: 'group' },
    { path: '/rider', label: 'มุมมองไรเดอร์ (Rider)', icon: 'moped' },
  ];

  currentTime = '';
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  badgeFor(path: string): string | number | null {
    if (path === '/orders') return this.ordersBadge || null;
    if (path === '/routes') return this.routesBadge || null;
    return null;
  }

  private tick(): void {
    this.currentTime = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
}
