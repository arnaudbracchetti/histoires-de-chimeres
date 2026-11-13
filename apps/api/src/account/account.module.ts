import { createHash, randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import {
  ChangeOwnPassword,
  ChooseAccessLinkPassword,
  CreateAccessLink,
  ReadAccessLink,
  type AccessLinkTokens,
  type Clock,
  InitializeFirstOrganizer,
  LogIn,
  LogOut,
  ReadOwnAccount,
  type AccountReader,
  type AccountRepository,
  type AccountSessions,
  type ConventionRepository,
  type FirstOrganizer,
  type FirstOrganizerFingerprint,
  type PasswordHasher,
} from '@chimeres/application';
import { CLOCK } from '../clock/clock.token.js';
import { ParisClock } from '../clock/paris-clock.js';
import { CONVENTION_REPOSITORY } from '../convention/convention-repository.token.js';
import { ConventionModule } from '../convention/convention.module.js';
import { ACCESS_LINK_TOKENS } from './access-link-tokens.token.js';
import { ACCOUNT_READER } from './account-reader.token.js';
import { ACCOUNT_REPOSITORY } from './account-repository.token.js';
import { ACCOUNT_SESSIONS } from './account-sessions.token.js';
import { FIRST_ORGANIZER_FINGERPRINT } from './first-organizer-fingerprint.token.js';
import { FIRST_ORGANIZER_SETTINGS } from './first-organizer-settings.token.js';
import { readFirstOrganizerFromEnvironment } from './first-organizer-settings.js';
import { FirstOrganizerStartup } from './first-organizer-startup.js';
import { AccessLinkController } from './http/access-link.controller.js';
import { AccountController } from './http/account.controller.js';
import { LoginAttempts } from './login-attempts.js';
import { LOGIN_ATTEMPTS } from './login-attempts.token.js';
import { PASSWORD_HASHER } from './password-hasher.token.js';
import { PrismaAccountReader } from './persistence/prisma-account-reader.js';
import { PrismaAccountRepository } from './persistence/prisma-account-repository.js';
import { PrismaAccountSessions } from './persistence/prisma-account-sessions.js';
import { PrismaFirstOrganizerFingerprint } from './persistence/prisma-first-organizer-fingerprint.js';
import { RandomAccessLinkTokens } from './random-access-link-tokens.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

/** L'empreinte d'une valeur du premier Organisateur : SHA-256 du couple (ADR 0016). */
const computeFingerprint = ({ nickname, password }: FirstOrganizer) =>
  createHash('sha256')
    .update(JSON.stringify([nickname, password]))
    .digest('hex');

/**
 * Le compte du back office : connexion, session, lien d'accès, premier Organisateur (ADR 0015 à
 * 0019).
 */
@Module({
  imports: [ConventionModule],
  controllers: [AccountController, AccessLinkController],
  providers: [
    { provide: CLOCK, useClass: ParisClock },
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    { provide: ACCOUNT_READER, useClass: PrismaAccountReader },
    { provide: ACCOUNT_SESSIONS, useClass: PrismaAccountSessions },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: LOGIN_ATTEMPTS, useClass: LoginAttempts },
    { provide: FIRST_ORGANIZER_FINGERPRINT, useClass: PrismaFirstOrganizerFingerprint },
    { provide: ACCESS_LINK_TOKENS, useClass: RandomAccessLinkTokens },
    {
      provide: CreateAccessLink,
      useFactory: (
        accounts: AccountRepository,
        sessions: AccountSessions,
        tokens: AccessLinkTokens,
        clock: Clock,
      ) => new CreateAccessLink(accounts, sessions, tokens, clock),
      inject: [ACCOUNT_REPOSITORY, ACCOUNT_SESSIONS, ACCESS_LINK_TOKENS, CLOCK],
    },
    {
      provide: ReadAccessLink,
      useFactory: (
        accounts: AccountRepository,
        reader: AccountReader,
        tokens: AccessLinkTokens,
        clock: Clock,
      ) => new ReadAccessLink(accounts, reader, tokens, clock),
      inject: [ACCOUNT_REPOSITORY, ACCOUNT_READER, ACCESS_LINK_TOKENS, CLOCK],
    },
    {
      provide: ChooseAccessLinkPassword,
      useFactory: (
        accounts: AccountRepository,
        reader: AccountReader,
        tokens: AccessLinkTokens,
        hasher: PasswordHasher,
        sessions: AccountSessions,
        clock: Clock,
      ) => new ChooseAccessLinkPassword(accounts, reader, tokens, hasher, sessions, clock),
      inject: [
        ACCOUNT_REPOSITORY,
        ACCOUNT_READER,
        ACCESS_LINK_TOKENS,
        PASSWORD_HASHER,
        ACCOUNT_SESSIONS,
        CLOCK,
      ],
    },
    { provide: FIRST_ORGANIZER_SETTINGS, useFactory: readFirstOrganizerFromEnvironment },
    {
      provide: LogIn,
      useFactory: (
        accounts: AccountRepository,
        hasher: PasswordHasher,
        sessions: AccountSessions,
        reader: AccountReader,
      ) => new LogIn(accounts, hasher, sessions, reader),
      inject: [ACCOUNT_REPOSITORY, PASSWORD_HASHER, ACCOUNT_SESSIONS, ACCOUNT_READER],
    },
    {
      provide: LogOut,
      useFactory: (sessions: AccountSessions) => new LogOut(sessions),
      inject: [ACCOUNT_SESSIONS],
    },
    {
      provide: ReadOwnAccount,
      useFactory: (sessions: AccountSessions, reader: AccountReader) =>
        new ReadOwnAccount(sessions, reader),
      inject: [ACCOUNT_SESSIONS, ACCOUNT_READER],
    },
    {
      provide: ChangeOwnPassword,
      useFactory: (
        sessions: AccountSessions,
        accounts: AccountRepository,
        reader: AccountReader,
        hasher: PasswordHasher,
      ) => new ChangeOwnPassword(sessions, accounts, reader, hasher),
      inject: [ACCOUNT_SESSIONS, ACCOUNT_REPOSITORY, ACCOUNT_READER, PASSWORD_HASHER],
    },
    {
      provide: InitializeFirstOrganizer,
      useFactory: (
        conventions: ConventionRepository,
        accounts: AccountRepository,
        hasher: PasswordHasher,
        sessions: AccountSessions,
        fingerprint: FirstOrganizerFingerprint,
      ) =>
        new InitializeFirstOrganizer(
          conventions,
          accounts,
          hasher,
          sessions,
          fingerprint,
          randomUUID,
          computeFingerprint,
        ),
      inject: [
        CONVENTION_REPOSITORY,
        ACCOUNT_REPOSITORY,
        PASSWORD_HASHER,
        ACCOUNT_SESSIONS,
        FIRST_ORGANIZER_FINGERPRINT,
      ],
    },
    FirstOrganizerStartup,
  ],
  // Pour le garde d'accès, global, déclaré dans AppModule après le garde CSRF, et pour les rôles
  // donnés depuis la fiche d'un pseudo.
  exports: [ACCOUNT_SESSIONS, ACCOUNT_READER, ACCOUNT_REPOSITORY],
})
export class AccountModule {}
