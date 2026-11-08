import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  MARKETING_CAMPAIGNS,
  type MarketingEvent,
  type MarketingCampaign,
  type MarketingPromotion,
  type MarketingAdminRead,
  type CampaignConfiguration,
  type CampaignSetting,
} from '@tea/contracts';
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
  private async setting(
    tx: Pick<Prisma.TransactionClient, 'campaignSetting'>,
    campaign: MarketingCampaign,
  ): Promise<CampaignSetting> {
    const row = await tx.campaignSetting.findUnique({ where: { campaign } });
    return {
      campaign,
      enabled:
        row?.enabled ?? (campaign === 'WIN_BACK' && readEnvironment().MARKETING_WINBACK_ENABLED),
      revision: row?.revision ?? 0,
    };
  }
  async enabled(campaign: MarketingCampaign) {
    return (await this.setting(this.db, campaign)).enabled;
  }
  async readAdmin(input: MarketingAdminRead) {
    return this.db.$transaction(
      async (tx) => {
        if (input.kind === 'SETTINGS')
          return Promise.all(MARKETING_CAMPAIGNS.map((x) => this.setting(tx, x)));
        const q = input.q?.trim().replace(/[\\%_]/g, '\\$&');
        const where = {
          ...(input.campaign ? { campaign: input.campaign } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(q ? { profile: { email: { contains: q, mode: 'insensitive' as const } } } : {}),
        };
        const total = await tx.emailLog.count({ where });
        const rows = await tx.emailLog.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 20,
          skip: (input.page - 1) * 20,
          select: {
            id: true,
            campaign: true,
            status: true,
            attempts: true,
            promotionTitle: true,
            createdAt: true,
            sentAt: true,
            profile: { select: { email: true } },
          },
        });
        return {
          items: rows.map(({ profile, ...x }) => ({
            ...x,
            email: profile.email,
            createdAt: x.createdAt.toISOString(),
            sentAt: x.sentAt?.toISOString() ?? null,
          })),
          page: input.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async configure(input: CampaignConfiguration, actorId: string) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ actorId, ...input }))
      .digest('hex');
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, 'campaign-command:' + input.key);
        const old = await tx.campaignCommand.findUnique({ where: { key: input.key } });
        if (old) {
          if (old.fingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
          return old.result as unknown as CampaignSetting;
        }
        await this.lock(tx, 'campaign:' + input.campaign);
        const current = await this.setting(tx, input.campaign);
        if (current.revision !== input.expectedRevision) throw new Error('CAMPAIGN_STATE_CONFLICT');
        const row = await tx.campaignSetting.upsert({
          where: { campaign: input.campaign },
          create: { campaign: input.campaign, enabled: input.enabled, revision: 1 },
          update: { enabled: input.enabled, revision: { increment: 1 } },
        });
        if (!input.enabled)
          await tx.emailLog.updateMany({
            where: { campaign: input.campaign, status: 'PENDING' },
            data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
          });
        const result: CampaignSetting = {
          campaign: input.campaign,
          enabled: row.enabled,
          revision: row.revision,
        };
        await tx.campaignCommand.create({
          data: {
            key: input.key,
            actorId,
            campaign: input.campaign,
            enabled: input.enabled,
            fingerprint,
            result: result as unknown as Prisma.InputJsonObject,
          },
        });
        return result;
      },
      { timeout: 15000 },
    );
  }
  async syncPromotions(items: MarketingPromotion[]) {
    for (const item of items)
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, 'promotion:' + item.id);
        const old = await tx.promotionSnapshot.findUnique({ where: { id: item.id } });
        const data = {
          title: item.title,
          active: item.active,
          startsAt: new Date(item.startsAt),
          endsAt: new Date(item.endsAt),
          revision: item.revision,
        };
        if (!old) await tx.promotionSnapshot.create({ data: { id: item.id, ...data } });
        else if (item.revision > old.revision)
          await tx.promotionSnapshot.update({ where: { id: item.id }, data });
      });
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
    campaign: string = 'WIN_BACK',
  ) {
    if (campaign === 'DISCOUNT') {
      const promo = await tx.promotionSnapshot.findUnique({ where: { id: cycleId } });
      return !!promo && promo.active && promo.startsAt <= now && promo.endsAt > now;
    }
    if (campaign !== 'WIN_BACK') return false;
    const latest = await tx.marketingPurchase.findFirst({
      where: { profileId, completedAt: { lte: now } },
      orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
    });
    if (!latest || latest.id !== cycleId) return false;
    return winBackDue({ last: latest.completedAt, now });
  }
  async schedule(now: Date) {
    if (await this.enabled('DISCOUNT')) await this.scheduleDiscounts(now);
    if (!(await this.enabled('WIN_BACK'))) return;
    const candidates = await this.db.$queryRaw<{ id: string; email: string; cycle: string }[]>`
      WITH stats AS (
        SELECT p.id,p.email,COUNT(o.id) AS count,MIN(o.completed_at) AS first,MAX(o.completed_at) AS last,
        (SELECT m.id FROM marketing_purchases m WHERE m.profile_id=p.id AND m.completed_at<=${now} ORDER BY m.completed_at DESC,m.id LIMIT 1) AS cycle
        FROM customer_profiles p JOIN marketing_purchases o ON o.profile_id=p.id AND o.completed_at<=${now}
        WHERE p.consent=true AND (p.last_marketing_at IS NULL OR p.last_marketing_at<=${new Date(now.getTime() - week)}) GROUP BY p.id
      ) SELECT id,email,cycle FROM stats WHERE ${now}-last >= INTERVAL '30 days'
      AND NOT EXISTS(SELECT 1 FROM email_logs e WHERE e.profile_id=stats.id AND e.campaign='WIN_BACK' AND e.cycle_id=stats.cycle)
      AND NOT EXISTS(SELECT 1 FROM email_logs e WHERE e.profile_id=stats.id AND e.status='PENDING')
      ORDER BY last,id LIMIT 20`;
    for (const c of candidates)
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, 'campaign:WIN_BACK');
        await this.lock(tx, c.email);
        const profile = await tx.customerProfile.findUniqueOrThrow({ where: { id: c.id } });
        if (
          !profile.consent ||
          !(await this.setting(tx, 'WIN_BACK')).enabled ||
          (profile.lastMarketingAt && now.getTime() - profile.lastMarketingAt.getTime() < week) ||
          !(await this.eligible(tx, c.id, c.cycle, now))
        )
          return;
        if (await tx.emailLog.findFirst({ where: { profileId: c.id, status: 'PENDING' } })) return;
        await tx.emailLog.upsert({
          where: {
            profileId_campaign_cycleId: { profileId: c.id, campaign: 'WIN_BACK', cycleId: c.cycle },
          },
          create: { profileId: c.id, campaign: 'WIN_BACK', cycleId: c.cycle, nextAttemptAt: now },
          update: {},
        });
      });
  }
  private async scheduleDiscounts(now: Date) {
    const promos = await this.db.promotionSnapshot.findMany({
      where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
    });
    for (const promo of promos) {
      const profiles = await this.db.$queryRaw<
        { id: string; email: string }[]
      >`SELECT p.id,p.email FROM customer_profiles p WHERE p.consent=true AND (p.last_marketing_at IS NULL OR p.last_marketing_at<=${new Date(now.getTime() - week)}) AND NOT EXISTS(SELECT 1 FROM email_logs e WHERE e.profile_id=p.id AND (e.status='PENDING' OR (e.campaign='DISCOUNT' AND e.cycle_id=${promo.id}::uuid))) ORDER BY p.id LIMIT 20`;
      for (const p of profiles)
        await this.db.$transaction(async (tx) => {
          await this.lock(tx, 'campaign:DISCOUNT');
          await this.lock(tx, p.email);
          const profile = await tx.customerProfile.findUniqueOrThrow({ where: { id: p.id } });
          if (
            !(await this.setting(tx, 'DISCOUNT')).enabled ||
            !profile.consent ||
            (profile.lastMarketingAt && now.getTime() - profile.lastMarketingAt.getTime() < week) ||
            !(await this.eligible(tx, p.id, promo.id, now, 'DISCOUNT')) ||
            (await tx.emailLog.findFirst({ where: { profileId: p.id, status: 'PENDING' } }))
          )
            return;
          await tx.emailLog.upsert({
            where: {
              profileId_campaign_cycleId: {
                profileId: p.id,
                campaign: 'DISCOUNT',
                cycleId: promo.id,
              },
            },
            create: {
              profileId: p.id,
              campaign: 'DISCOUNT',
              cycleId: promo.id,
              promotionTitle: promo.title,
              nextAttemptAt: now,
            },
            update: {},
          });
        });
    }
  }
  async deliver(now: Date) {
    const claimed = await this.db.$transaction(async (tx) => {
      await tx.emailLog.updateMany({
        where: { status: 'PENDING', attempts: { gte: 3 }, leaseUntil: { lte: now } },
        data: { status: 'FAILED', leaseId: null, leaseUntil: null },
      });
      const [row] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM email_logs WHERE campaign IN ('WIN_BACK','DISCOUNT') AND status='PENDING' AND attempts<3 AND next_attempt_at<=${now} AND (lease_until IS NULL OR lease_until<=${now}) ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
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
        profile.lastMarketingJobId !== job.id &&
        profile.lastMarketingAt &&
        now.getTime() - profile.lastMarketingAt.getTime() < week;
      if (
        !profile.consent ||
        !MARKETING_CAMPAIGNS.includes(job.campaign as MarketingCampaign) ||
        !(await this.setting(tx, job.campaign as MarketingCampaign)).enabled ||
        rateLimited ||
        !(await this.eligible(tx, profile.id, job.cycleId, now, job.campaign))
      ) {
        await tx.emailLog.update({
          where: { id: job.id },
          data: { status: 'CANCELLED', leaseId: null, leaseUntil: null },
        });
        return false;
      }
      if (
        profile.lastMarketingJobId !== job.id ||
        !profile.lastMarketingAt ||
        now.getTime() - profile.lastMarketingAt.getTime() >= week
      ) {
        await tx.customerProfile.update({
          where: { id: profile.id },
          data: { lastMarketingAt: now, lastMarketingJobId: job.id },
        });
      }
      if (!job.firstAttemptAt)
        await tx.emailLog.update({ where: { id: job.id }, data: { firstAttemptAt: now } });
      return true;
    });
    if (!reserved) return true;
    // Serialize unsubscribe with the bounded SMTP submission; no mail starts after opt-out returns.
    await this.db.$transaction(
      async (tx) => {
        await this.lock(tx, 'campaign:' + claimed.campaign);
        await this.lock(tx, claimed.profile.email);
        const job = await tx.emailLog.findUniqueOrThrow({ where: { id: claimed.id } });
        const profile = await tx.customerProfile.findUniqueOrThrow({
          where: { id: claimed.profileId },
        });
        if (job.status !== 'PENDING' || job.leaseId !== claimed.leaseId) return;
        const sendNow = new Date(Math.max(now.getTime(), Date.now()));
        if (
          !profile.consent ||
          !(await this.setting(tx, job.campaign as MarketingCampaign)).enabled ||
          !(await this.eligible(tx, profile.id, job.cycleId, sendNow, job.campaign))
        ) {
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
            campaign: job.campaign as MarketingCampaign,
            promotionTitle: job.promotionTitle ?? undefined,
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
