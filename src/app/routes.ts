import { Routes } from '@angular/router';
import { OrderManagementComponent } from './components/order-management/order-management';
import { RouteDashboardComponent } from './components/route-dashboard/route-dashboard';
import { Rider } from './pages/rider/rider';
import { Main } from './pages/main/main';
import { RiderSettings } from './pages/rider-settings/rider-settings';

export const routes: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  { path: 'orders', component: OrderManagementComponent },
  { path: 'routes', component: RouteDashboardComponent },
  { path: 'rider', component: Rider },
  { path: 'rider-settings', component: RiderSettings },
  { path: 'main', component: Main },
  { path: '**', redirectTo: 'orders' }
];
