import { Controller, Get, Inject } from '@nestjs/common';
import { ReadSignUpTracking } from '@chimeres/application';
import { signUpTrackingEndpoints, type ResponseOf } from '@chimeres/contract';

@Controller()
export class SignUpTrackingController {
  constructor(
    @Inject(ReadSignUpTracking) private readonly readSignUpTracking: ReadSignUpTracking,
  ) {}

  @Get(signUpTrackingEndpoints.read.path)
  read(): Promise<ResponseOf<typeof signUpTrackingEndpoints.read>> {
    return this.readSignUpTracking.execute();
  }
}
