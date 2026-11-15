// Les descripteurs de `contract` dont le test se sert, chacun nommé pour le tag `endpoint`.
import {
  accountEndpoints,
  availabilityEndpoints,
  conventionEndpoints,
  frontOfficeEndpoints,
  linkedPhoneEndpoints,
  participantEndpoints,
  pushSubscriptionEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
} from '../../packages/contract/dist/index.js';
import { nameEndpoints } from './api.ts';

export const account = nameEndpoints('accountEndpoints', accountEndpoints);
export const availability = nameEndpoints('availabilityEndpoints', availabilityEndpoints);
export const convention = nameEndpoints('conventionEndpoints', conventionEndpoints);
export const frontOffice = nameEndpoints('frontOfficeEndpoints', frontOfficeEndpoints);
export const linkedPhone = nameEndpoints('linkedPhoneEndpoints', linkedPhoneEndpoints);
export const participant = nameEndpoints('participantEndpoints', participantEndpoints);
export const pushSubscription = nameEndpoints(
  'pushSubscriptionEndpoints',
  pushSubscriptionEndpoints,
);
export const scenario = nameEndpoints('scenarioEndpoints', scenarioEndpoints);
export const schedule = nameEndpoints('scheduleEndpoints', scheduleEndpoints);
export const signUp = nameEndpoints('signUpEndpoints', signUpEndpoints);
export const table = nameEndpoints('tableEndpoints', tableEndpoints);
export const timeSlot = nameEndpoints('timeSlotEndpoints', timeSlotEndpoints);
