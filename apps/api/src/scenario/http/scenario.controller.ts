import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { ProposeScenario, UpdateScenario, type ScenarioReader } from '@chimeres/application';
import {
  scenarioEndpoints,
  type ResponseOf,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { ZodBody } from '../../http/zod-body.pipe.js';
import { SCENARIO_READER } from '../scenario-reader.token.js';
import { scenarioBodySchema } from './scenario-body.schema.js';

@Controller()
export class ScenarioController {
  constructor(
    @Inject(SCENARIO_READER) private readonly reader: ScenarioReader,
    @Inject(ProposeScenario) private readonly proposeScenario: ProposeScenario,
    @Inject(UpdateScenario) private readonly updateScenario: UpdateScenario,
  ) {}

  @Get(scenarioEndpoints.read.path)
  read(
    @Param('scenarioId') scenarioId: string,
  ): Promise<ResponseOf<typeof scenarioEndpoints.read>> {
    return this.readOrRefuse(scenarioId);
  }

  /** Renvoie le scénario créé, relu. */
  @Post(scenarioEndpoints.propose.path)
  async propose(
    @Param('gameMasterId') gameMasterId: string,
    @Body(new ZodBody(scenarioBodySchema)) body: ScenarioBody,
  ): Promise<ResponseOf<typeof scenarioEndpoints.propose>> {
    const scenarioId = await this.proposeScenario.execute(gameMasterId, body);
    return this.readOrRefuse(scenarioId);
  }

  /** Renvoie le scénario relu. */
  @Put(scenarioEndpoints.update.path)
  async update(
    @Param('scenarioId') scenarioId: string,
    @Body(new ZodBody(scenarioBodySchema)) body: ScenarioBody,
  ): Promise<ResponseOf<typeof scenarioEndpoints.update>> {
    await this.updateScenario.execute(scenarioId, body);
    return this.readOrRefuse(scenarioId);
  }

  /** Un scénario inconnu répond 404, comme le refus du domaine pour une écriture. */
  private async readOrRefuse(scenarioId: string): Promise<ScenarioDto> {
    const scenario = await this.reader.read(scenarioId);
    if (!scenario) throw new Refusal('scenario-not-found', {});
    return scenario;
  }
}
