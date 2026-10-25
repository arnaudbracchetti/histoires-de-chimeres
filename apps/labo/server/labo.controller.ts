// PROTOTYPE (#59). Routes en dur, sans `contract` ni validation : code jetable.
import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import type { PushSubscription } from 'web-push';
import {
  type Entry,
  type Findings,
  findings,
  note,
  phone,
  phoneByEndpoint,
  phones,
  publicKey,
  pushHost,
  schedule,
  type SendRequest,
  sends,
} from './state.js';

const COOKIE = 'labo';
const KEY = process.env['LABO_CLE'];

function checkKey(key: string | undefined) {
  if (KEY && key !== KEY) throw new ForbiddenException('clé de pilotage absente ou fausse');
}

function readCookie(request: Request): string | undefined {
  const pair = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  return pair?.slice(COOKIE.length + 1);
}

@Controller('api')
export class LaboController {
  @Get('cle-publique')
  publicKey() {
    return { publicKey: publicKey || null };
  }

  @Post('telephones')
  hello(@Body() body: { phoneId: string; name: string; context: string; userAgent: string; href: string }) {
    const target = phone(body.phoneId);
    target.name = body.name;
    target.context = body.context;
    target.userAgent = body.userAgent;
    return {};
  }

  @Post('journal')
  journal(@Body() body: { phoneId: string; entries: Omit<Entry, 'from'>[] }) {
    const target = phone(body.phoneId);
    for (const entry of body.entries) note(target, entry.text, 'téléphone', entry.at);
    return {};
  }

  @Get('cookie')
  cookie(@Req() request: Request, @Query('telephone') phoneId: string) {
    const raw = readCookie(request);
    const value = raw ? JSON.parse(Buffer.from(raw, 'base64url').toString()) : null;
    note(
      phone(phoneId),
      value
        ? `Cookie lu : posé par ${value.name || value.by} (${value.context}) le ${new Date(value.at).toISOString()}`
        : 'Cookie lu : aucun',
    );
    return { value };
  }

  @Post('cookie')
  setCookie(@Res({ passthrough: true }) response: Response, @Body() body: { phoneId: string; context: string }) {
    const target = phone(body.phoneId);
    const value = { by: body.phoneId, name: target.name, context: body.context, at: Date.now() };
    response.cookie(COOKIE, Buffer.from(JSON.stringify(value)).toString('base64url'), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 400 * 24 * 3600 * 1000,
    });
    note(target, `Cookie posé (${body.context})`);
    return { value };
  }

  @Delete('cookie')
  clearCookie(@Res({ passthrough: true }) response: Response, @Query('telephone') phoneId: string) {
    response.clearCookie(COOKIE, { path: '/' });
    note(phone(phoneId), 'Cookie effacé');
    return {};
  }

  @Post('abonnements')
  subscribe(@Body() body: { phoneId: string; subscription: PushSubscription; via: string }) {
    const target = phone(body.phoneId);
    const previous = target.subscription?.endpoint;
    // Un endpoint n'appartient qu'à un seul téléphone (ADR 0010).
    for (const other of phones.values()) {
      if (other !== target && other.subscription?.endpoint === body.subscription.endpoint) {
        other.subscription = undefined;
        note(other, `Abonnement repris par ${target.name || target.id}`);
      }
    }
    target.subscription = body.subscription;
    target.subscriptionVia = body.via;
    target.subscriptionAt = Date.now();
    const change = !previous ? 'nouveau' : previous === body.subscription.endpoint ? 'inchangé' : 'endpoint changé';
    note(target, `Abonnement reçu (${body.via}) : ${pushHost(body.subscription.endpoint)}, ${change}`);
    return { change };
  }

  @Delete('abonnements')
  unsubscribe(@Query('telephone') phoneId: string) {
    const target = phone(phoneId);
    target.subscription = undefined;
    note(target, 'Abonnement retiré par le téléphone');
    return {};
  }

  // Appelé par sw-labo.js à chaque push que le service worker voit passer.
  @Post('recus')
  received(@Body() body: { endpoint?: string; n: number | null; source: string; at: number }) {
    const send = sends.find((s) => s.n === body.n);
    if (send) {
      send.receivedAt = Date.now();
      send.receivedSource = body.source;
    }
    const target = phoneByEndpoint(body.endpoint) ?? (send && phones.get(send.phoneId));
    if (target) {
      const delay = send?.sentAt ? ` ${((Date.now() - send.sentAt) / 1000).toFixed(1)} s après l’envoi` : '';
      note(target, `Push n°${body.n} vu par le service worker (${body.source})${delay}`);
    }
    return {};
  }

  @Post('clics')
  click(@Body() body: { phoneId: string; n: number; via: string }) {
    const send = sends.find((s) => s.n === body.n);
    if (send) {
      send.clickedAt = Date.now();
      send.via = body.via;
    }
    note(phone(body.phoneId), `Ouvert par la notification n°${body.n} (${body.via})`);
    return {};
  }

  // Connexion longue : le serveur note quand le téléphone la perd et la retrouve.
  @Get('flux')
  stream(@Req() request: Request, @Res() response: Response, @Query('telephone') phoneId: string) {
    const target = phone(phoneId);
    const openedAt = Date.now();
    note(target, 'Flux SSE ouvert');
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    });
    response.write('retry: 3000\n\n');
    let k = 0;
    const timer = setInterval(() => response.write(`data: ${JSON.stringify({ k: ++k, at: Date.now() })}\n\n`), 5000);
    request.on('close', () => {
      clearInterval(timer);
      note(target, `Flux SSE fermé après ${Math.round((Date.now() - openedAt) / 1000)} s`);
    });
  }

  // Page lue par le service worker en `freshness` : hors ligne, sa date dit d'où elle vient.
  @Get('programme')
  programme() {
    return {
      generatedAt: Date.now(),
      parties: [
        { creneau: 1, titre: 'La Tour des Mille Soupirs', jeu: 'L’Appel de Cthulhu', table: 7 },
        { creneau: 1, titre: 'Les Brumes d’Avalon', jeu: 'Pendragon', table: 4 },
        { creneau: 2, titre: 'Sang d’encre à Port-Vesper', jeu: 'Blades in the Dark', table: 12 },
      ],
    };
  }

  @Get('qr.svg')
  async qr(@Res() response: Response, @Query('url') url: string) {
    response.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2, width: 260 }));
  }

  @Get('pilotage/etat')
  state(@Headers('x-labo-cle') key: string) {
    checkKey(key);
    return {
      phones: [...phones.values()]
        .sort((a, b) => b.lastSeen - a.lastSeen)
        .map((p) => ({ ...p, pushHost: pushHost(p.subscription?.endpoint), subscription: undefined, hasSubscription: !!p.subscription })),
      sends,
      findings,
    };
  }

  @Post('pilotage/constats')
  saveFindings(@Headers('x-labo-cle') key: string, @Body() body: Findings) {
    checkKey(key);
    findings.devices = body.devices;
    findings.cells = body.cells;
    return {};
  }

  @Post('pilotage/envois')
  send(@Headers('x-labo-cle') key: string, @Body() body: SendRequest) {
    checkKey(key);
    if (!publicKey) throw new ForbiddenException('pas de clés VAPID dans l’environnement');
    return schedule(body);
  }

  @Delete('pilotage/telephones/:id')
  forget(@Headers('x-labo-cle') key: string, @Param('id') id: string) {
    checkKey(key);
    phones.delete(id);
    return {};
  }
}
