import { Component } from '@angular/core';
import { PageHeader } from '../shell/page-header';

@Component({
  selector: 'app-calendar-page',
  imports: [PageHeader],
  template: `<app-page-header title="Calendrier" />`,
})
export class CalendarPage {}
