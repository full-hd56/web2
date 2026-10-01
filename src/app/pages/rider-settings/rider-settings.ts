import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  capacity: number; // กล่อง / คัน
  active: boolean;
}

@Component({
  selector: 'app-rider-settings',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './rider-settings.html',
  styleUrl: './rider-settings.css',
})
export class RiderSettings implements OnInit, OnDestroy {
  // แถบเวลา + ข้อมูลศูนย์กระจาย (เหมือนไซด์บาร์หน้าอื่น ๆ ในแอป)
  currentTime = '';
  private timerInterval: any;
  peakWindow = '11:30 - 12:30 น.';

  riders: RiderProfile[] = [
    { id: 'R001', name: 'สมชาย ใจดี', phone: '081-111-1111', vehicle: 'มอเตอร์ไซค์', capacity: 10, active: true },
    { id: 'R002', name: 'สมหญิง รักเรียน', phone: '082-222-2222', vehicle: 'มอเตอร์ไซค์', capacity: 10, active: true },
    { id: 'R003', name: 'มานะ อดทน', phone: '083-333-3333', vehicle: 'มอเตอร์ไซค์พ่วงข้าง', capacity: 15, active: false },
  ];

  defaultCapacity = 10;
  serviceRadiusKm = 3.0;

  editingId: string | null = null;

  newRider: { name: string; phone: string; vehicle: string; capacity: number } = {
    name: '',
    phone: '',
    vehicle: 'มอเตอร์ไซค์',
    capacity: this.defaultCapacity,
  };

  formError = '';

  get activeCount() {
    return this.riders.filter((r) => r.active).length;
  }

  get totalCapacity() {
    return this.riders
      .filter((r) => r.active)
      .reduce((sum, r) => sum + r.capacity, 0);
  }

  addRider() {
    this.formError = '';
    if (!this.newRider.name.trim() || !this.newRider.phone.trim()) {
      this.formError = 'กรุณากรอกชื่อและเบอร์โทรไรเดอร์ให้ครบ';
      return;
    }
    const nextNumber = this.riders.length + 1;
    this.riders.push({
      id: `R${String(nextNumber).padStart(3, '0')}`,
      name: this.newRider.name.trim(),
      phone: this.newRider.phone.trim(),
      vehicle: this.newRider.vehicle.trim() || 'มอเตอร์ไซค์',
      capacity: this.newRider.capacity || this.defaultCapacity,
      active: true,
    });
    this.newRider = { name: '', phone: '', vehicle: 'มอเตอร์ไซค์', capacity: this.defaultCapacity };
  }

  startEdit(rider: RiderProfile) {
    this.editingId = rider.id;
  }

  stopEdit() {
    this.editingId = null;
  }

  toggleActive(rider: RiderProfile) {
    rider.active = !rider.active;
  }

  removeRider(rider: RiderProfile) {
    this.riders = this.riders.filter((r) => r.id !== rider.id);
    if (this.editingId === rider.id) {
      this.editingId = null;
    }
  }

  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
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
}
