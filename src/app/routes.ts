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
  { path: '**', redirectTo: 'orders' }
];
