import {
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ChangeScenarioImage,
  RemoveScenarioImage,
  type ScenarioImageReader,
  type ScenarioReader,
} from '@chimeres/application';
import { IMAGE_MAX_BYTES, scenarioEndpoints, type ResponseOf } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { ImageRefusedError } from '../../http/image-refused.error.js';
import { MalformedRequestError } from '../../http/malformed-request.error.js';
import { SCENARIO_IMAGE_READER } from '../scenario-image-reader.token.js';
import { SCENARIO_READER } from '../scenario-reader.token.js';

/**
 * L'image d'un scénario, hors du DTO JSON (ADR 0007) : envoi en multipart, retrait, et lecture
 * par une URL immuable.
 */
@Controller()
export class ScenarioImageController {
  constructor(
    @Inject(SCENARIO_READER) private readonly scenarios: ScenarioReader,
    @Inject(SCENARIO_IMAGE_READER) private readonly images: ScenarioImageReader,
    @Inject(ChangeScenarioImage) private readonly changeScenarioImage: ChangeScenarioImage,
    @Inject(RemoveScenarioImage) private readonly removeScenarioImage: RemoveScenarioImage,
  ) {}

  /** Renvoie le scénario relu, avec l'URL de sa nouvelle image. Au-delà de 10 Mo, multer répond 413. */
  @Put(scenarioEndpoints.changeImage.path)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: IMAGE_MAX_BYTES, files: 1 } }))
  async change(
    @Param('scenarioId') scenarioId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<ResponseOf<typeof scenarioEndpoints.changeImage>> {
    if (!file) throw new MalformedRequestError('Aucun fichier au champ « image ».');
    await this.changeScenarioImage.execute(scenarioId, file.buffer);
    return this.readOrRefuse(scenarioId);
  }

  /** Renvoie le scénario relu, sans image. */
  @Delete(scenarioEndpoints.removeImage.path)
  async remove(
    @Param('scenarioId') scenarioId: string,
  ): Promise<ResponseOf<typeof scenarioEndpoints.removeImage>> {
    await this.removeScenarioImage.execute(scenarioId);
    return this.readOrRefuse(scenarioId);
  }

  /** Une URL ne change jamais de contenu : un an de cache, sans revalidation ni `ETag`. */
  @Get(scenarioEndpoints.readImage.path)
  @Header('Cache-Control', 'max-age=31536000, immutable')
  async read(
    @Param('scenarioId') scenarioId: string,
    @Param('imageId') imageId: string,
  ): Promise<StreamableFile> {
    const bytes = await this.images.read(scenarioId, imageId);
    if (!bytes) throw new ImageRefusedError('image-not-found');
    return new StreamableFile(bytes, { type: 'image/webp' });
  }

  private async readOrRefuse(scenarioId: string) {
    const scenario = await this.scenarios.read(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    return scenario;
  }
}
