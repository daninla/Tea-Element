import { Module } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { readEnvironment } from '../../config/environment';
import { PaymentProvider } from './domain/payment-provider';
import { FakePaymentProvider } from './infrastructure/fake-payment-provider';
import { LiqPayProvider } from './infrastructure/liqpay-provider';
@Module({
  providers: [
    {
      provide: PaymentProvider,
      useFactory: () => {
        const env = readEnvironment();
        if (env.PAYMENT_PROVIDER === 'fake')
          return new FakePaymentProvider(
            env.FAKE_PAYMENT_SECRET ?? randomBytes(32).toString('hex'),
          );
        return new LiqPayProvider({
          publicKey: env.LIQPAY_PUBLIC_KEY!,
          privateKey: env.LIQPAY_PRIVATE_KEY!,
          callbackUrl: env.PAYMENT_CALLBACK_URL!,
          storefrontOrigin: env.CORS_ORIGIN,
        });
      },
    },
  ],
  exports: [PaymentProvider],
})
export class PaymentProvidersModule {}
