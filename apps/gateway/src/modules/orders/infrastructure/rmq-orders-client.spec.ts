import { HttpException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import { RmqOrdersClient } from './rmq-orders-client';

const request = { input: {}, context: { correlationId: 'test' } };
function setup() {
  const transport = { send: jest.fn(), close: jest.fn() };
  const client = new RmqOrdersClient(transport as unknown as ClientProxy);
  return { transport, client };
}

it('returns the RPC value directly to callers', async () => {
  const { transport, client } = setup();
  const value = { number: 'TE-test' };
  transport.send.mockReturnValue(of({ ok: true, value }));
  await expect(client.request('orders.get', request)).resolves.toBe(value);
  expect(transport.send).toHaveBeenCalledWith('orders.get', request);
});

it('preserves a business error status and body', async () => {
  const { transport, client } = setup();
  const error = { code: 'ORDER_NOT_FOUND', message: 'Order not found', statusCode: 404 };
  transport.send.mockReturnValue(of({ ok: false, error }));
  const failure = await client.request('orders.get', request).catch((e: unknown) => e);
  expect(failure).toBeInstanceOf(HttpException);
  expect((failure as HttpException).getStatus()).toBe(404);
  expect((failure as HttpException).getResponse()).toEqual(error);
});

it('maps a connection failure to 503 without exposing the transport error', async () => {
  const { transport, client } = setup();
  transport.send.mockReturnValue(throwError(() => new Error('private transport details')));
  const failure = await client.request('orders.get', request).catch((e: unknown) => e);
  expect((failure as HttpException).getStatus()).toBe(503);
  expect((failure as HttpException).getResponse()).toEqual({
    code: 'ORDERS_UNAVAILABLE',
    message: 'Orders temporarily unavailable',
    statusCode: 503,
  });
});

it('maps a missing RPC response to 503 after the existing deadline', async () => {
  jest.useFakeTimers();
  try {
    const { transport, client } = setup();
    transport.send.mockReturnValue(NEVER);
    const failure = client.request('orders.get', request).catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(8000);
    expect(((await failure) as HttpException).getStatus()).toBe(503);
  } finally {
    jest.useRealTimers();
  }
});
