import { Component } from '@angular/core';
import { ConventionForm } from '../convention/convention-form';
import { PageHeader } from '../shell/page-header';
import { TimeSlotList } from '../time-slots/time-slot-list';

@Component({
  selector: 'app-time-slots-and-tables-page',
  imports: [ConventionForm, PageHeader, TimeSlotList],
  template: `
    <app-page-header title="Créneaux et tables" />
    <section aria-labelledby="convention-title">
      <h2 id="convention-title">Convention</h2>
      <app-convention-form />
    </section>
    <section aria-labelledby="time-slots-title">
      <h2 id="time-slots-title">Créneaux</h2>
      <app-time-slot-list />
    </section>
  `,
  styles: `
    @layer components {
      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
        padding: var(--space-l) var(--space-xl);
      }

      h2 {
        font-size: var(--font-size-section);
      }
    }
  `,
})
export class TimeSlotsAndTablesPage {}
