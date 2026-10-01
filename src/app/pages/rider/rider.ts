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

  jobs: Job[] = [
    { detail: 'คุณ A - 081-111-1111', boxes: 2, lat: 16.2467, lng: 103.2541, done: false },
    { detail: 'คุณ B - 082-222-2222', boxes: 3, lat: 16.2500, lng: 103.2600, done: false },
    { detail: 'คุณ C - 083-333-3333', boxes: 1, lat: 16.2420, lng: 103.2480, done: false },
  ];

  get totalBoxes() {
    return this.jobs.reduce((sum, j) => sum + j.boxes, 0);
  }

  navUrl(job: Job) {
    return `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}&travelmode=driving`;
  }

  markDone(job: Job) {
    job.done = true;
  }
}