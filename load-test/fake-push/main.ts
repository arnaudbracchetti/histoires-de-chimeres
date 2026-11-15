// Point d'entrée du conteneur : réglages par l'environnement, certificat écrit par entrypoint.sh.
import { readFileSync } from 'node:fs';
import { startFakePush } from './fake-push.ts';

const fakePush = await startFakePush({
  pushHost: process.env.PUSH_HOST ?? 'fake-push',
  pushPort: Number(process.env.PUSH_PORT ?? '8443'),
  adminPort: Number(process.env.ADMIN_PORT ?? '8081'),
  delayMs: Number(process.env.DELAY_MS ?? '0'),
  tls: {
    key: readFileSync('/tls/key.pem'),
    cert: readFileSync('/tls/cert.pem'),
  },
});
console.log(`fake-push prêt, administration sur ${fakePush.adminOrigin}`);
process.on('SIGTERM', () => void fakePush.close().then(() => process.exit(0)));
