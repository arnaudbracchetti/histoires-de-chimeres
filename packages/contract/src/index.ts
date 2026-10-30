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
  type GameMasterGameDto,
  type GameMasterNicknameBody,
  type GameMasterParams,
  type GameMasterSheetDto,
  type WithdrawalDto,
} from './game-master.js';
export {
  PRESENCE_CODE_PARAM,
  frontOfficeEndpoints,
  type FrontOfficeDto,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
  type FrontOfficeTimeSlotDto,
  type DrawResultDto,
  type ParticipantSituationDto,
  type PresenceCodeBody,
  type TimeSlotStateDto,
  signUpEndpoints,
} from './front-office.js';
export { TIME_SLOT_PARAM, frontOfficePaths, frontOfficeUrls } from './front-office-paths.js';
export { healthEndpoints, type HealthDto } from './health.js';
export {
  linkedPhoneEndpoints,
  type IdentityConfirmationDto,
  type LinkedPhoneDto,
  type LinkPhoneBody,
  type LinkPhoneDto,
} from './linked-phone.js';
export type {
  ApiErrorCode,
  FieldErrorDto,
  ProblemCode,
  ProblemDto,
  RefusalCode,
  RefusalParams,
  VerdictRefusalDto,
} from './problem.js';
export {
  CONTENT_WARNINGS_MAX_LENGTH,
  IMAGE_MAX_BYTES,
  PRESENTATION_MAX_LENGTH,
  SCENARIO_TITLE_MAX_LENGTH,
  SYSTEM_MAX_LENGTH,
  scenarioEndpoints,
  type DurationDto,
  type ScenarioBody,
  type ScenarioDto,
  type ScenarioGameMasterDto,
  type ScenarioImageParams,
  type ScenarioListItemDto,
  type ScenarioParams,
  type ScenarioSummaryDto,
  type SeatsDto,
} from './scenario.js';
export {
  scheduleEndpoints,
  type GameDto,
  type GameParams,
  type MoveGameBody,
  type MovePlacementDto,
  type PlacementDto,
  type ReserveScenarioDto,
  type ScheduleDto,
  type ScheduleGameBody,
  type ScheduleScenarioDto,
  type SwapGamesBody,
} from './schedule.js';
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
export {
  pushSubscriptionEndpoints,
  type PushPublicKeyDto,
  type PushSubscriptionBody,
} from './push-subscription.js';
