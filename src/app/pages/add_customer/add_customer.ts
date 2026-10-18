import { AfterViewInit, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Sidebar } from '../../components/sidebar/sidebar';
import * as L from 'leaflet';

import { Customer } from '../../models/customer';

// ที่อยู่ของ backend (ถ้ารัน backend ในเครื่องเอง เปลี่ยนเป็น 'http://localhost:3000')
const API_URL = 'https://back-n-web2.vercel.app';

interface customer_in_form {
  name: string;
  phone: string;
  address_detail: string;
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-add-customer',
  imports: [CommonModule, FormsModule, Sidebar],
  templateUrl: './add_customer.html',
  styleUrl: './add_customer.css',
})
export class AddCustomer implements OnInit, AfterViewInit, OnDestroy {
  // แผนที่สำหรับเลือกพิกัด (Leaflet + OpenStreetMap แบบเดียวกับหน้าออเดอร์)
  private map?: L.Map;
  private pin?: L.Marker;
  private readonly DEFAULT_CENTER: L.LatLngExpression = [16.2467, 103.2522]; // ม.มหาสารคาม (ขามเรียง)

  // ===== signal: ค่าเปลี่ยน → หน้าจออัปเดตเอง =====
  customers = signal<Customer[]>([]);
  loading = signal(false);
  saving = signal(false);

  // ถ้าเป็น null = โหมดเพิ่มลูกค้าใหม่, ถ้ามีค่า = กำลังแก้ไขลูกค้าคนนั้น
  editingId = signal<number | null>(null);

  form = signal<customer_in_form>(this.empty_form());
  formError = signal('');
  successMsg = signal('');

  constructor(private http: HttpClient) {}

  private empty_form(): customer_in_form {
    return { name: '', phone: '', address_detail: '', latitude: null as any, longitude: null as any };
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ===== แผนที่ =====
  private initMap(): void {
    this.map = L.map('customerMap').setView(this.DEFAULT_CENTER, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    // คลิกบนแผนที่ = เลือกพิกัดตรงนั้น
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.set_location(e.latlng.lat, e.latlng.lng, false);
    });

    //แผนที่โหลดภาพมาไม่เต็มกรอบ มีส่วนสีเทาว่างๆ ค้าง
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  // ตั้งพิกัดในฟอร์ม + ย้ายหมุดบนแผนที่
  private set_location(lat: number, lng: number, moveMap: boolean): void {
    // update = แก้แค่ละติจูด/ลองจิจูด ช่องอื่นในฟอร์มคงเดิม
    this.form.update((f) => ({
      ...f,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    }));
    this.placePin(lat, lng, moveMap);
  }

  private placePin(lat: number, lng: number, moveMap: boolean): void {
    if (!this.map) return;
    if (!this.pin) {
      const icon = L.divIcon({
        className: '',
        html: '<span class="icon icon-fill" style="font-size:38px;color:#e11d48;display:block;transform:translate(-50%,-100%);text-shadow:0 2px 4px rgba(0,0,0,.25)">location_on</span>',
        iconSize: [0, 0],
      });
      this.pin = L.marker([lat, lng], { icon, draggable: true }).addTo(this.map);
      // ลากหมุดเพื่อปรับตำแหน่ง
      this.pin.on('dragend', () => {
        const p = this.pin!.getLatLng();
        this.set_location(p.lat, p.lng, false);
      });
    } else {
      this.pin.setLatLng([lat, lng]);
    }
    if (moveMap) this.map.setView([lat, lng], 17);
  }

  private removePin(): void {
    this.pin?.remove();
    this.pin = undefined;
  }

  // พิมพ์พิกัดเองในช่อง ละติจูด/ลองจิจูด แล้วหมุดย้ายตาม
  onCoordInput(): void {
    const f = this.form();
    const lat = Number(f.latitude);
    const lng = Number(f.longitude);
    if (f.latitude != null && f.longitude != null && !isNaN(lat) && !isNaN(lng)) {
      this.placePin(lat, lng, true);
    }
  }

  // ดึงรายชื่อลูกค้าทั้งหมด  GET /customer
  loadCustomers(): void {
    this.loading.set(true);
    this.http.get<Customer[]>(`${API_URL}/customer`).subscribe({
      next: (data) => {
        this.customers.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.formError.set('โหลดรายชื่อลูกค้าไม่สำเร็จ: ' + (err.error?.message ?? err.message));
      },
    });
  }

  // กดปุ่มบันทึก: ถ้าไม่ได้แก้ไขอยู่ = เพิ่มใหม่ (POST), ถ้าแก้ไขอยู่ = อัปเดต (PUT)
  save(): void {
    this.formError.set('');
    this.successMsg.set('');
    const f = this.form();

    if (!f.name.trim() || !f.phone.trim() || !f.address_detail.trim()) {
      this.formError.set('กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบ');
      return;
    }
    if (f.latitude == null || f.longitude == null ||
        isNaN(Number(f.latitude)) || isNaN(Number(f.longitude))) {
      this.formError.set('กรุณากรอกพิกัดละติจูด/ลองจิจูดให้ถูกต้อง');
      return;
    }

    const body: customer_in_form = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      address_detail: f.address_detail.trim(),
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
    };

    const id = this.editingId();
    this.saving.set(true);
    const request = id === null
      ? this.http.post(`${API_URL}/customer`, body)
      : this.http.put(`${API_URL}/customer/${id}`, body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.successMsg.set(id === null ? 'เพิ่มลูกค้าเรียบร้อย' : 'บันทึกการแก้ไขเรียบร้อย');
        this.cancelEdit();
        this.loadCustomers();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set('บันทึกไม่สำเร็จ: ' + (err.error?.message ?? err.message));
      },
    });
  }

  // กดปุ่มแก้ไขในตาราง: เอาข้อมูลลูกค้าคนนั้นมาใส่ในฟอร์ม
  startEdit(c: Customer): void {
    this.editingId.set(c.id);
    this.form.set({
      name: c.name,
      phone: c.phone,
      address_detail: c.address_detail,
      latitude: c.latitude,
      longitude: c.longitude,
    });
    this.formError.set('');
    this.successMsg.set('');
    this.placePin(c.latitude, c.longitude, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.set(this.empty_form());
    this.removePin();
  }

  // ลบลูกค้า (DELETE /customer/:id)
  async deleteCustomer(id: number) {
    if (!confirm('ต้องการลบลูกค้าคนนี้ใช่ไหม?')) return;
    this.formError.set('');
    this.successMsg.set('');
    try {
      await lastValueFrom(
        this.http.delete(`${API_URL}/customer/${id}`),
      );
      if (this.editingId() === id) this.cancelEdit(); // ถ้ากำลังแก้ไขคนนี้อยู่ ให้ล้างฟอร์ม
      this.successMsg.set('ลบลูกค้าเรียบร้อย');
      this.loadCustomers();
    } catch (err: any) {
      // แสดง error บนหน้าจอ เช่น 404 = backend ยังไม่มี route ลบ หรือไม่พบลูกค้า
      this.formError.set('ลบไม่สำเร็จ (' + err.status + '): ' + (err.error?.error ?? err.message));
    }
  }

  // ใช้พิกัดจาก GPS ของเครื่อง (เบราว์เซอร์จะขออนุญาตก่อน)
  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.formError.set('เบราว์เซอร์นี้ไม่รองรับการดึงตำแหน่ง');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.set_location(pos.coords.latitude, pos.coords.longitude, true),
      () => this.formError.set('ดึงตำแหน่งไม่สำเร็จ กรุณากรอกพิกัดเอง'),
    );
  }
}