import { Component } from '@angular/core';

interface Job {
  detail: string;
  boxes: number;
  lat: number;
  lng: number;
  done: boolean;
}

@Component({
  selector: 'app-rider',
  imports: [],
  templateUrl: './rider.html',
  styleUrl: './rider.css',
})
export class Rider {
  riderId = '001';

  // หมายเลขงาน (task number) ที่รับอยู่ ถ้าเป็น null = ยังไม่ได้รับงาน → แสดงหน้าใส่หมายเลขงาน
  taskNumber: string | null = null;
  taskError = '';

  jobs: Job[] = [];

  // ข้อมูลจำลอง: หมายเลขงาน → รายการจุดส่ง
  // TODO: เมื่อ backend มี API แล้ว เปลี่ยนไปเรียก GET /api/tasks/:task_number แทน
  private mockTasks: Record<string, Job[]> = {
    T001: [
      { detail: 'คุณ A - 081-111-1111', boxes: 2, lat: 16.2467, lng: 103.2541, done: false },
      { detail: 'คุณ B - 082-222-2222', boxes: 3, lat: 16.2500, lng: 103.2600, done: false },
      { detail: 'คุณ C - 083-333-3333', boxes: 1, lat: 16.2420, lng: 103.2480, done: false },
    ],
    T002: [
      { detail: 'คุณ D - 084-444-4444', boxes: 2, lat: 16.2482, lng: 103.2541, done: false },
      { detail: 'คุณ E - 085-555-5555', boxes: 1, lat: 16.2449, lng: 103.2498, done: false },
    ],
  };

  // กดปุ่ม "รับงาน": ตรวจหมายเลขงานแล้วโหลดรายการจุดส่ง
  acceptTask(input: HTMLInputElement) {
    const no = input.value.trim().toUpperCase();
    if (!no) {
      this.taskError = 'กรุณาใส่หมายเลขงาน';
      return;
    }
    const found = this.mockTasks[no];
    if (!found) {
      this.taskError = `ไม่พบงานหมายเลข ${no}`;
      return;
    }
    this.jobs = found.map((j) => ({ ...j })); // copy เพื่อไม่ให้แก้ข้อมูลต้นฉบับ
    this.taskNumber = no;
    this.taskError = '';
  }

  // ออกจากงานนี้ กลับไปหน้าใส่หมายเลขงาน
  leaveTask() {
    if (!confirm('ออกจากงานนี้ใช่ไหม?')) return;
    this.taskNumber = null;
    this.jobs = [];
  }

  get totalBoxes() {
    return this.jobs.reduce((sum, j) => sum + j.boxes, 0);
  }

  get doneCount() {
    return this.jobs.filter((j) => j.done).length;
  }

  // ดึงเบอร์โทรจาก detail เช่น 'คุณ A - 081-111-1111' → '0811111111'
  phone(job: Job) {
    const m = job.detail.match(/[0-9][0-9-]{8,}/);
    return m ? m[0].replace(/-/g, '') : '';
  }

  navUrl(job: Job) {
    return `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}&travelmode=driving`;
  }

  markDone(job: Job) {
    job.done = true;
  }
}
