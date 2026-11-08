import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MarketingEvent } from '@tea/contracts';
import type { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { CampaignStore, CampaignMailer } from '../domain/campaign-store';
import { winBackDue } from '../domain/win-back-rule';
import { unsubscribeToken, validUnsubscribe } from './unsubscribe-token';
const week = 7 * 86400000;
@Injectable()
export class PrismaCampaignStore extends CampaignStore {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CampaignMailer) private readonly mailer: CampaignMailer,
  ) {
    super();
  }
  private lock(tx: Prisma.TransactionClient, email: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email},0))`;
  }
  async ingest(event: MarketingEvent) {
    await this.db.$transaction(async (tx) => {
      if (await tx.processedEvent.findUnique({ where: { id: event.eventId } })) return;
      const email = event.payload.email.trim().toLowerCase();
      await this.lock(tx, email);
      if (await tx.processedEvent.findUnique({ where: { id: event.eventId } })) return;
      const duplicate =
        event.name === 'UserRegistered'
          ? await tx.marketingRegistration.findUnique({ where: { id: event.payload.userId } })
          : await tx.marketingPurchase.findUnique({ where: { id: event.payload.orderId } });
      if (!duplicate) {
        const existing = await tx.customerProfile.findUnique({ where: { email } });
        if (
          event.name === 'OrderCompleted' &&
          !existing &&
          !(event.payload.marketingConsent && event.payload.marketingConsentAt)
        ) {
          await tx.processedEvent.create({ data: { id: event.eventId } });
          return;
        }
        const profile = await tx.customerProfile.upsert({
          where: { email },
          create: {
            email,
            firstName: event.payload.marketingConsent ? event.payload.firstName : '',
            tokenNonce: randomBytes(32).toString('base64url'),
          },
          update: {},
        });
        const consentAt =
          event.name === 'UserRegistered'
            ? new Date(event.occurredAt)
            : event.payload.marketingConsent && event.payload.marketingConsentAt
              ? new Date(event.payload.marketingConsentAt)
              : null;
        const newDecision = consentAt && (!profile.consentAt || consentAt > profile.consentAt);
        if (newDecision) {
          await tx.customerProfile.update({
            where: { id: profile.id },
            data: {
              consent: event.payload.marketingConsent,
              consentAt,
              firstName: event.payload.marketingConsent ? event.payload.firstName : '',
            },
          });
          if (!event.payload.marketingConsent) {
            await tx.emailLog.updateMany({
              where: { profileId: profile.id, status: 'PENDING' },
              data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
            });
            await tx.marketingPurchase.deleteMany({ where: { profileId: profile.id } });
          }
        }
        if (event.name === 'UserRegistered')
          await tx.marketingRegistration.create({
            data: { id: event.payload.userId, profileId: profile.id },
          });
        else if (
          (newDecision ? event.payload.marketingConsent : profile.consent) &&
          new Date(event.occurredAt) >= (newDecision ? consentAt! : profile.consentAt!)
        )
          await tx.marketingPurchase.create({
            data: {
              id: event.payload.orderId,
              profileId: profile.id,
              total: event.payload.total,
              completedAt: new Date(event.occurredAt),
            },
          });
      }
      await tx.processedEvent.create({ data: { id: event.eventId } });
    });
  }
  async unsubscribe(token: string) {
    const id = token.split('.')[0]!;
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw new Error('INVALID_TOKEN');
    await this.db.$transaction(
      async (tx) => {
        const initial = await tx.customerProfile.findUnique({ where: { id } });
        if (
          !initial ||
          !validUnsubscribe(
            token,
            id,
            initial.tokenNonce,
            readEnvironment().MARKETING_UNSUBSCRIBE_SECRET,
          )
        )
          throw new Error('INVALID_TOKEN');
        await this.lock(tx, initial.email);
        await tx.customerProfile.update({
          where: { id },
          data: { consent: false, consentAt: new Date(), firstName: '' },
        });
        await tx.emailLog.updateMany({
          where: { profileId: id, status: 'PENDING' },
          data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
        });
        await tx.marketingPurchase.deleteMany({ where: { profileId: id } });
      },
      { timeout: 15000 },
    );
  }
  private async eligible(
    tx: Prisma.TransactionClient,
    profileId: string,
    cycleId: string,
    now: Date,
  ) {
    const latest = await tx.marketingPurchase.findFirst({
      where: { profileId, completedAt: { lte: now } },
      orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
    });
    if (!latest || latest.id !== cycleId) return false;
    const stats = await tx.marketingPurchase.aggregate({
      where: { profileId, completedAt: { lte: now } },
      _count: { _all: true },
      _min: { completedAt: true },
      _max: { completedAt: true },
    });
    return winBackDue({
      count: stats._count._all,
      first: stats._min.completedAt!,
      last: stats._max.completedAt!,
      now,
    });
  }
  async schedule(now: Date) {
    if (!readEnvironment().MARKETING_WINBACK_ENABLED) return;
    const candidates = await this.db.$queryRaw<{ id: string; email: string; cycle: string }[]>`
      WITH stats AS (
        SELECT p.id,p.email,COUNT(o.id) AS count,MIN(o.completed_at) AS first,MAX(o.completed_at) AS last,
        (SELECT m.id FROM marketing_purchases m WHERE m.profile_id=p.id AND m.completed_at<=${now} ORDER BY m.completed_at DESC,m.id LIMIT 1) AS cycle
        FROM customer_profiles p JOIN marketing_purchases o ON o.profile_id=p.id AND o.completed_at<=${now}
        WHERE p.consent=true AND (p.last_marketing_at IS NULL OR p.last_marketing_at<=${new Date(now.getTime() - week)}) GROUP BY p.id
      ) SELECT id,email,cycle FROM stats WHERE ${now}-last >= GREATEST(30,CEIL(1.5*EXTRACT(EPOCH FROM(last-first))/86400/GREATEST(count-1,1))) * INTERVAL '1 day'
      AND NOT EXISTS(SELECT 1 FROM email_logs e WHERE e.profile_id=stats.id AND e.campaign='WIN_BACK' AND e.cycle_id=stats.cycle)
      ORDER BY last,id LIMIT 20`;
    for (const c of candidates)
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, c.email);
        const profile = await tx.customerProfile.findUniqueOrThrow({ where: { id: c.id } });
        if (
          !profile.consent ||
          (profile.lastMarketingAt && now.getTime() - profile.lastMarketingAt.getTime() < week) ||
          !(await this.eligible(tx, c.id, c.cycle, now))
        )
          return;
        await tx.emailLog.upsert({
          where: {
            profileId_campaign_cycleId: { profileId: c.id, campaign: 'WIN_BACK', cycleId: c.cycle },
          },
          create: { profileId: c.id, campaign: 'WIN_BACK', cycleId: c.cycle, nextAttemptAt: now },
          update: {},
        });
      });
  }
  async deliver(now: Date) {
    if (!readEnvironment().MARKETING_WINBACK_ENABLED) return false;
    const claimed = await this.db.$transaction(async (tx) => {
      await tx.emailLog.updateMany({
        where: { status: 'PENDING', attempts: { gte: 3 }, leaseUntil: { lte: now } },
        data: { status: 'FAILED', leaseId: null, leaseUntil: null },
      });
      const [row] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM email_logs WHERE campaign='WIN_BACK' AND status='PENDING' AND attempts<3 AND next_attempt_at<=${now} AND (lease_until IS NULL OR lease_until<=${now}) ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!row) return null;
      return tx.emailLog.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          leaseId: randomUUID(),
          leaseUntil: new Date(now.getTime() + 60000),
        },
        include: { profile: true },
      });
    });
    if (!claimed) return false;
    // Reserve the global frequency slot durably before any external SMTP call.
    const reserved = await this.db.$transaction(async (tx) => {
      await this.lock(tx, claimed.profile.email);
      const job = await tx.emailLog.findUniqueOrThrow({ where: { id: claimed.id } });
      const profile = await tx.customerProfile.findUniqueOrThrow({
        where: { id: claimed.profileId },
      });
      if (job.status !== 'PENDING' || job.leaseId !== claimed.leaseId) return false;
      const rateLimited =
        !job.firstAttemptAt &&
        profile.lastMarketingAt &&
        now.getTime() - profile.lastMarketingAt.getTime() < week;
      if (
        !profile.consent ||
        rateLimited ||
        !(await this.eligible(tx, profile.id, job.cycleId, now))
      ) {
        await tx.emailLog.update({
          where: { id: job.id },
          data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
        });
        return false;
      }
      if (!job.firstAttemptAt) {
        await tx.customerProfile.update({
          where: { id: profile.id },
          data: { lastMarketingAt: now },
        });
        await tx.emailLog.update({ where: { id: job.id }, data: { firstAttemptAt: now } });
      }
      return true;
    });
    if (!reserved) return true;
    // Serialize unsubscribe with the bounded SMTP submission; no mail starts after opt-out returns.
    await this.db.$transaction(
      async (tx) => {
        await this.lock(tx, claimed.profile.email);
        const job = await tx.emailLog.findUniqueOrThrow({ where: { id: claimed.id } });
        const profile = await tx.customerProfile.findUniqueOrThrow({
          where: { id: claimed.profileId },
        });
        if (job.status !== 'PENDING' || job.leaseId !== claimed.leaseId) return;
        if (!profile.consent || !(await this.eligible(tx, profile.id, job.cycleId, now))) {
          await tx.emailLog.update({
            where: { id: job.id },
            data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
          });
          return;
        }
        const env = readEnvironment(),
          url = new URL('/unsubscribe', env.WEB_URL);
        url.hash =
          'token=' +
          unsubscribeToken(profile.id, profile.tokenNonce, env.MARKETING_UNSUBSCRIBE_SECRET);
        let sent = false;
        try {
          await this.mailer.send({
            id: job.id,
            email: profile.email,
            firstName: profile.firstName,
            unsubscribeUrl: url.href,
            catalogUrl: new URL('/catalog', env.WEB_URL).href,
          });
          sent = true;
        } catch {
          /* Never persist raw SMTP errors or recipient/bearer information in logs. */
        }
        await tx.emailLog.updateMany({
          where: { id: job.id, leaseId: claimed.leaseId, status: 'PENDING' },
          data: {
            status: sent ? 'SENT' : job.attempts >= 3 ? 'FAILED' : 'PENDING',
            sentAt: sent ? now : null,
            leaseId: null,
            leaseUntil: null,
            nextAttemptAt: new Date(now.getTime() + 5000 * 2 ** (job.attempts - 1)),
          },
        });
      },
      { timeout: 15000 },
    );
    return true;
  }
}
