import { Component } from '@angular/core';
import { ConventionForm } from './convention-form';
import { PageHeader } from '../shell/page-header';
import { TableList } from '../tables/table-list';
import { TimeSlotList } from '../time-slots/time-slot-list';

@Component({
  selector: 'app-time-slots-and-tables-page',
  imports: [ConventionForm, PageHeader, TableList, TimeSlotList],
  template: `
    <app-page-header title="Créneaux et tables" />
    <div class="page-body">
      <section class="convention" aria-labelledby="convention-title">
        <h2 id="convention-title">Convention</h2>
        <app-convention-form />
      </section>
      <section aria-labelledby="time-slots-title">
        <h2 id="time-slots-title">Créneaux</h2>
        <app-time-slot-list />
      </section>
      <section aria-labelledby="tables-title">
        <h2 id="tables-title">Tables</h2>
        <app-table-list />
      </section>
    </div>
  `,
  styles: `
    @layer components {
      /* La convention en une carte résumée, puis les créneaux et les tables côte à côte : toute
         la page tient dans l'écran. */
      .page-body {
        display: grid;
        grid-template-columns: 30rem minmax(0, 1fr);
        gap: calc(2 * var(--space-xl)) var(--space-xxl);
        align-items: start;
      }

      .convention {
        grid-column: 1 / -1;
      }

      section {
        display: flex;
        flex-direction: column;
        gap: var(--space-m);
      }

      h2 {
        font-size: var(--font-size-section);
      }
    }
  `,
})
export class TimeSlotsAndTablesPage {}
