import { Routes } from '@angular/router';
import { Main } from './pages/main/main';
import { Rider } from './pages/rider/rider';

export const routes: Routes = [
  { path: '', component: Main },
  { path: 'rider', component: Rider },
];
