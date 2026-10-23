export {
  CONVENTION_NAME_MAX_LENGTH,
  conventionEndpoints,
  type ConventionDto,
  type UpdateConventionBody,
} from './convention.js';
export { availabilityEndpoints, type AvailabilityParams } from './availability.js';
export {
  API_PREFIX,
  apiUrl,
  endpoint,
  type BodyOf,
  type Endpoint,
  type ParamsArgs,
  type ParamsOf,
  type ResponseOf,
} from './endpoint.js';
export {
  NICKNAME_MAX_LENGTH,
  gameMasterEndpoints,
  type GameMasterDto,
  type GameMasterNicknameBody,
  type GameMasterParams,
} from './game-master.js';
export { healthEndpoints, type HealthDto } from './health.js';
export type {
  ApiErrorCode,
  FieldErrorDto,
  ProblemCode,
  ProblemDto,
  RefusalCode,
  RefusalParams,
} from './problem.js';
export {
  TABLE_NAME_MAX_LENGTH,
  tableEndpoints,
  type TableDto,
  type TableNameBody,
  type TableParams,
} from './table.js';
export {
  timeSlotEndpoints,
  type TimeSlotDto,
  type TimeSlotHoursBody,
  type TimeSlotParams,
} from './time-slot.js';
