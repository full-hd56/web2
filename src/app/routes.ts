import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'orders', pathMatch: 'full' },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: 'routes',
    loadComponent: () => import('./pages/route_dashboard/route_dashboard').then((m) => m.RouteDashboard),
  },
  {
    path: 'rider',
    loadComponent: () => import('./pages/rider/rider').then((m) => m.Rider),
  },
  {
    path: 'customers',
    loadComponent: () => import('./pages/add_customer/add_customer').then((m) => m.AddCustomer),
  },
  {
    path: 'main',
    loadComponent: () => import('./pages/main/main').then((m) => m.Main),
  },
  { path: '**', redirectTo: 'orders' },
];
