import { createApp } from './app.js';
import { connectStore } from './store.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}
const resources = await connectStore({
  databaseUrl: required('DATABASE_URL'), redisUrl: required('REDIS_URL'),
  demoEmail: required('DEMO_EMAIL'), demoPassword: required('DEMO_PASSWORD'),
});
const app = await createApp(resources.store);
app.addHook('onClose', resources.close);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => { app.close().catch(error => { app.log.error(error); process.exitCode = 1; }); });
}
try {
  await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3001) });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
