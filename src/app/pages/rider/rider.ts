import { Component, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

// ที่อยู่ของ backend (ถ้ารัน backend ในเครื่องเอง เปลี่ยนเป็น 'http://localhost:3000')
const API_URL = 'https://back-n-web2.vercel.app';

// จุดส่ง 1 จุด (มาจาก task_items + orders + customers)
interface TaskItem {
  id: number;               // id ของจุดส่ง (ใช้ตอนกด ส่งสำเร็จ)
  stop_sequence: number;    // ลำดับการส่ง
  delivery_status: string;  // PENDING / DELIVERED / LATE / FAILED
  order_id: number;
  box_amount: number;
  customer_name: string;
  phone: string;
  address_detail: string;
  latitude: number;
  longitude: number;
}

// ใบงาน 1 ใบ (มาจาก delivery_tasks)
interface DeliveryTask {
  task_number: string;
  total_boxes: number;
  total_distance: number;
  estimated_minutes: number;
  items: TaskItem[];
}

@Component({
  selector: 'app-rider',
  imports: [],
  templateUrl: './rider.html',
  styleUrl: './rider.css',
})
export class Rider {
  // ใบงานที่รับอยู่ ถ้าเป็น null = ยังไม่ได้รับงาน → แสดงหน้าใส่หมายเลขงาน
  task = signal<DeliveryTask | null>(null);
  loading = signal(false);
  taskError = signal('');
  savingId = signal<number | null>(null); // id ของจุดที่กำลังบันทึก "ส่งสำเร็จ"

  // จำนวนจุดที่ส่งแล้ว
  doneCount = computed(() => (this.task()?.items ?? []).filter((i) => this.isDone(i)).length);

  // จุดที่ต้องส่ง "ตอนนี้" = จุดแรก (ตามลำดับ) ที่ยังไม่ส่ง
  // ไรเดอร์ต้องส่งตามลำดับ กดข้ามไปจุดถัดไปไม่ได้
  currentItem = computed(() => {
    const items = [...(this.task()?.items ?? [])].sort((a, b) => a.stop_sequence - b.stop_sequence);
    return items.find((i) => !this.isDone(i)) ?? null;
  });

  constructor(private http: HttpClient) {}

  // กดปุ่ม "รับงาน": ดึงใบงานจาก backend  GET /api/delivery_tasks/:task_number
  async acceptTask(input: HTMLInputElement) {
    const no = input.value.trim().toUpperCase();
    if (!no) {
      this.taskError.set('กรุณาใส่หมายเลขงาน');
      return;
    }

    this.loading.set(true);
    this.taskError.set('');
    try {
      const res = await lastValueFrom(
        this.http.get<DeliveryTask>(`${API_URL}/api/delivery_tasks/${encodeURIComponent(no)}`),
      );
      this.task.set(res);
    } catch (err: any) {
      if (err.status === 404) this.taskError.set(`ไม่พบงานหมายเลข ${no}`);
      else this.taskError.set('โหลดงานไม่สำเร็จ กรุณาลองใหม่');
    }
    this.loading.set(false);
  }

  // ออกจากงานนี้ กลับไปหน้าใส่หมายเลขงาน
  leaveTask() {
    if (!confirm('ออกจากงานนี้ใช่ไหม?')) return;
    this.task.set(null);
  }

  // กด "ส่งสำเร็จ"  PATCH /api/delivery_tasks/items/:id/delivered
  async markDone(item: TaskItem) {
    if (!this.isCurrent(item)) return; // กันกดข้ามลำดับ
    this.savingId.set(item.id);
    try {
      const res: any = await lastValueFrom(
        this.http.patch(`${API_URL}/api/delivery_tasks/items/${item.id}/delivered`, {}),
      );
      // อัปเดตสถานะจุดนี้ในหน้าจอ (DELIVERED หรือ LATE)
      const t = this.task();
      if (t) {
        this.task.set({
          ...t,
          items: t.items.map((i) => (i.id === item.id ? { ...i, delivery_status: res.delivery_status } : i)),
        });
      }
    } catch (err: any) {
      alert('บันทึกไม่สำเร็จ: ' + (err.error?.error ?? err.message));
    }
    this.savingId.set(null);
  }

  // จุดนี้คือจุดที่ต้องส่งตอนนี้ไหม (กดนำทาง / ส่งสำเร็จ ได้เฉพาะจุดนี้)
  isCurrent(item: TaskItem) {
    return this.currentItem()?.id === item.id;
  }

  isDone(item: TaskItem) {
    return item.delivery_status === 'DELIVERED' || item.delivery_status === 'LATE';
  }

  navUrl(item: TaskItem) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving`;
  }
}
