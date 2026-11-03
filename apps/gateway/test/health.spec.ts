import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
describe('gateway HTTP boundary', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.LOG_LEVEL = 'silent';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('exposes liveness without authentication', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: 'gateway' });
  });
  it('does not expose unimplemented business endpoints', async () => {
    await request(app.getHttpServer()).post('/api/v1/orders/guest').send({}).expect(404);
  });
});
