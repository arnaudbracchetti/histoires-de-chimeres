import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import type { ConventionDto } from '@chimeres/contract';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly convention = httpResource<ConventionDto>(() => '/api/convention');
}
