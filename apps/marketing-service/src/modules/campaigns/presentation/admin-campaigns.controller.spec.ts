import { AdminCampaignsRpcController } from './admin-campaigns.controller';
import { ReadCampaignAdmin } from '../application/read-campaign-admin';
import { ConfigureCampaign } from '../application/configure-campaign';
const context = {
  userId: '10000000-0000-4000-8000-000000000001',
  role: 'ADMIN',
  correlationId: 'test',
};
test('rejects untrusted roles and unknown fields before executing use cases', async () => {
  const execute = jest.fn(),
    c = new AdminCampaignsRpcController(
      { execute } as unknown as ReadCampaignAdmin,
      { execute } as unknown as ConfigureCampaign,
    );
  expect(
    await c.get({ input: { kind: 'SETTINGS' }, context: { ...context, role: 'CUSTOMER' } }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  expect(await c.get({ input: { kind: 'LOGS', page: 0 }, context })).toMatchObject({
    ok: false,
    error: { statusCode: 400 },
  });
  expect(
    await c.write({
      input: {
        campaign: 'DISCOUNT',
        enabled: true,
        expectedRevision: 0,
        key: context.userId,
        actorId: context.userId,
      },
      context,
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(execute).not.toHaveBeenCalled();
});
test('binds actor to context and masks database/provider errors', async () => {
  const execute = jest
      .fn()
      .mockRejectedValueOnce(new Error('CAMPAIGN_STATE_CONFLICT'))
      .mockRejectedValueOnce(new Error('private db details')),
    c = new AdminCampaignsRpcController(
      { execute } as unknown as ReadCampaignAdmin,
      { execute } as unknown as ConfigureCampaign,
    ),
    input = { campaign: 'DISCOUNT', enabled: true, expectedRevision: 0, key: context.userId };
  expect(await c.write({ input, context })).toMatchObject({
    ok: false,
    error: { statusCode: 409 },
  });
  expect(execute).toHaveBeenCalledWith(input, context.userId);
  const result = await c.write({ input, context });
  expect(result).toMatchObject({ ok: false, error: { statusCode: 503 } });
  expect(JSON.stringify(result)).not.toContain('private');
});
