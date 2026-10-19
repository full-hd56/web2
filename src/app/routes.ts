
import { Routes } from '@angular/router';
import { Orders } from './pages/orders/orders';
import { RouteDashboard } from './pages/route_dashboard/route_dashboard';
import { Rider } from './pages/rider/rider';
import { Main } from './pages/main/main';
import { AddCustomer } from './pages/add_customer/add_customer';

export const routes: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  { path: 'orders', component: Orders },
  { path: 'routes', component: RouteDashboard },
  { path: 'rider', component: Rider },
  { path: 'customers', component: AddCustomer },
  { path: 'main', component: Main },
  { path: '**', redirectTo: 'orders' },
];

// import { Routes } from '@angular/router';
// import { OrderManagementComponent } from './components/order-management/order-management';
// import { RouteDashboardComponent } from './components/route-dashboard/route-dashboard';
// import { Rider } from './pages/rider/rider';
// import { Main } from './pages/main/main';
// import { RiderSettings } from './pages/add_customer/add_customer';

// export const routes: Routes = [
//   { path: '', redirectTo: 'orders', pathMatch: 'full' },
//   { path: 'orders', component: OrderManagementComponent },
//   { path: 'routes', component: RouteDashboardComponent },
//   { path: 'rider', component: Rider },
//   { path: 'rider-settings', component: RiderSettings },
//   { path: 'main', component: Main },
//   { path: '**', redirectTo: 'orders' }
// ];
