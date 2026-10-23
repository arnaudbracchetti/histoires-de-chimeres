import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  gameMasterEndpoints,
  IMAGE_MAX_BYTES,
  scenarioEndpoints,
  type GameMasterDto,
  type ScenarioDto,
  type ScenarioListItemDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

/** Une image unie, de la taille et du format demandés. */
const anImage = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#b0573a' } });

describe("Image d'un scénario (PR-7, ADR 0007)", () => {
  let app: INestApplication<App>;
  let scenario: ScenarioDto;

  beforeEach(async () => {
    app = await startApp();
    const { body: gameMasters } = await server()
      .post(apiUrl(gameMasterEndpoints.add))
      .send({ nickname: 'Kaïros' })
      .expect(201);
    const { body } = await server()
      .post(
        apiUrl(scenarioEndpoints.propose, {
          gameMasterId: (gameMasters as GameMasterDto[])[0]!.id,
        }),
      )
      .send({
        title: "La Tour d'ébène",
        system: "L'Appel de Cthulhu",
        presentation: 'Une tour, une nuit.',
        contentWarnings: '',
        seats: { min: 3, max: 5 },
        duration: 1,
      })
      .expect(201);
    scenario = body as ScenarioDto;
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const send = (bytes: Buffer, filename = 'image.jpg', scenarioId = scenario.id) =>
    server()
      .put(apiUrl(scenarioEndpoints.changeImage, { scenarioId }))
      .attach('image', bytes, filename);
  const removeImage = (scenarioId = scenario.id) =>
    server().delete(apiUrl(scenarioEndpoints.removeImage, { scenarioId }));
  const read = async () =>
    (
      await server()
        .get(apiUrl(scenarioEndpoints.read, { scenarioId: scenario.id }))
        .expect(200)
    ).body as ScenarioDto;
  /** Les octets d'une image, lus par son URL. */
  const download = (url: string) =>
    server()
      .get(url)
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      });

  it('recadre un JPEG paysage en WebP 3:2, orientation EXIF appliquée, métadonnées retirées', async () => {
    // 1200 × 2000 tourné d'un quart de tour par l'EXIF : un paysage de 2000 × 1200.
    const jpeg = await anImage(1200, 2000)
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'Kaïros' } } })
      .toBuffer();

    const response = await send(jpeg).expect(200);

    const { imageUrl } = response.body as ScenarioDto;
    expect(imageUrl).toMatch(/^\/api\/scenarios\/[0-9a-f-]{36}\/images\/[0-9a-f-]{36}$/);
    expect((await read()).imageUrl).toBe(imageUrl);
    const image = await download(imageUrl!).expect(200).expect('Content-Type', 'image/webp');
    const metadata = await sharp(image.body as Buffer).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 1200, height: 800 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('recadre un PNG portrait en 3:2 au centre, sans l’agrandir', async () => {
    const png = await anImage(600, 1200).png().toBuffer();

    const { body } = await send(png, 'image.png').expect(200);

    const image = await download((body as ScenarioDto).imageUrl!).expect(200);
    const metadata = await sharp(image.body as Buffer).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 600, height: 400 });
  });

  it('sert une image immuable : cache d’un an, sans ETag', async () => {
    const { body } = await send(await anImage(300, 200).webp().toBuffer()).expect(200);

    const response = await download((body as ScenarioDto).imageUrl!)
      .expect(200)
      .expect('Cache-Control', 'max-age=31536000, immutable');

    expect(response.headers['etag']).toBeUndefined();
  });

  it('donne une URL neuve à chaque envoi, et supprime l’ancienne image', async () => {
    const { body: first } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);
    const { body: second } = await send(await anImage(300, 200).avif().toBuffer()).expect(200);

    const firstUrl = (first as ScenarioDto).imageUrl!;
    const secondUrl = (second as ScenarioDto).imageUrl!;
    expect(secondUrl).not.toBe(firstUrl);
    await download(secondUrl).expect(200);
    const gone = await download(firstUrl).expect(404);
    expect(JSON.parse((gone.body as Buffer).toString())).toMatchObject({ code: 'image-not-found' });
  });

  it('supprime l’image avec son scénario', async () => {
    const { body } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);

    await server()
      .delete(apiUrl(scenarioEndpoints.remove, { scenarioId: scenario.id }))
      .expect(204);

    await download((body as ScenarioDto).imageUrl!).expect(404);
  });

  it('retire l’image : le scénario revient à l’illustration par défaut', async () => {
    const { body } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);

    const response = await removeImage().expect(200);

    expect((response.body as ScenarioDto).imageUrl).toBeNull();
    expect((await read()).imageUrl).toBeNull();
    await download((body as ScenarioDto).imageUrl!).expect(404);
  });

  it('montre l’image dans la liste des scénarios', async () => {
    const { body } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);

    const { body: list } = await server().get(apiUrl(scenarioEndpoints.list)).expect(200);

    expect((list as ScenarioListItemDto[])[0]!.imageUrl).toBe((body as ScenarioDto).imageUrl);
  });

  it('garde l’image quand le contenu du scénario change', async () => {
    const { body } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);
    const { imageUrl, id, gameMaster: _, ...content } = body as ScenarioDto;

    const { body: updated } = await server()
      .put(apiUrl(scenarioEndpoints.update, { scenarioId: id }))
      .send({ ...content, title: 'Autre titre' })
      .expect(200);

    expect((updated as ScenarioDto).imageUrl).toBe(imageUrl);
  });

  it.each([
    [
      'de plus de 10 Mo : 413',
      async () =>
        Buffer.concat([await anImage(10, 10).jpeg().toBuffer(), Buffer.alloc(IMAGE_MAX_BYTES)]),
      413,
      'image-too-large',
    ],
    ['GIF : 415', () => anImage(30, 20).gif().toBuffer(), 415, 'image-format-unsupported'],
    [
      'JPEG tronquée : 422',
      async () => (await anImage(300, 200).jpeg().toBuffer()).subarray(0, 400),
      422,
      'image-unreadable',
    ],
    [
      'de plus de 40 mégapixels : 422',
      () => anImage(8000, 5001).png({ compressionLevel: 1 }).toBuffer(),
      422,
      'image-unreadable',
    ],
  ])('refuse une image %s, et garde la précédente', async (_, image, status, code) => {
    const { body } = await send(await anImage(300, 200).jpeg().toBuffer()).expect(200);

    const response = await send(await image())
      .expect(status)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status, code, detail: expect.any(String) });
    expect((await read()).imageUrl).toBe((body as ScenarioDto).imageUrl);
  });

  it('demande un JPEG pour un format refusé', async () => {
    const response = await send(await anImage(30, 20).gif().toBuffer(), 'image.gif').expect(415);

    expect((response.body as { detail: string }).detail).toContain('JPEG');
  });

  it('refuse un envoi sans fichier : 400', async () => {
    const response = await server()
      .put(apiUrl(scenarioEndpoints.changeImage, { scenarioId: scenario.id }))
      .expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });

  it.each([
    [
      'envoyer une image à un',
      async () => send(await anImage(30, 20).jpeg().toBuffer(), 'a.jpg', UNKNOWN_ID),
      'scenario-not-found',
    ],
    ['retirer l’image d’un', () => removeImage(UNKNOWN_ID), 'scenario-not-found'],
    [
      'lire une image d’un',
      () =>
        download(apiUrl(scenarioEndpoints.readImage, { scenarioId: UNKNOWN_ID, imageId: 'abc' })),
      'image-not-found',
    ],
  ])('répond 404 pour %s scénario inconnu', async (_, action, code) => {
    const response = await action();

    expect(response.status).toBe(404);

    const body = Buffer.isBuffer(response.body)
      ? (JSON.parse(response.body.toString()) as unknown)
      : response.body;
    expect(body).toMatchObject({ code });
  });
});
