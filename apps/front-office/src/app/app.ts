import { Component } from '@angular/core';
import { conventionEndpoints } from '@chimeres/contract';
import { apiResource } from './api-resource';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly convention = apiResource(conventionEndpoints.read);
}
