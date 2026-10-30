import type { PushSubscriptionBody } from '@chimeres/contract';
import { z } from 'zod';

/** Forme du corps de `PUT front-office/linked-phone/push-subscription`, celle de `PushSubscription.toJSON()`. */
export const pushSubscriptionBodySchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
}) satisfies z.ZodType<PushSubscriptionBody>;
