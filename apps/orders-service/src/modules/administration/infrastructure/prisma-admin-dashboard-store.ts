import { Inject, Injectable } from '@nestjs/common';
import type { AdminDashboard, DashboardDays, DashboardDay } from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { AdminDashboardStore, reportNumber } from '../domain/admin-dashboard-store';
@Injectable()
export class PrismaAdminDashboardStore extends AdminDashboardStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async read(days: DashboardDays, asOf: Date): Promise<AdminDashboard> {
    return this.db.$transaction(
      async (tx) => {
        const [bounds] = await tx.$queryRaw<
          { start: Date }[]
        >`SELECT ((date_trunc('day',${asOf.toISOString()}::timestamptz AT TIME ZONE 'Europe/Kyiv')-(${days}::int-1)*interval '1 day') AT TIME ZONE 'Europe/Kyiv') AT TIME ZONE 'UTC' AS start`;
        const from = bounds!.start;
        const completed = Prisma.sql`SELECT o.id,o.total,o.payment_method,o.items,h.at FROM orders o JOIN (SELECT order_id,MIN(created_at) AS at FROM order_status_history WHERE status='COMPLETED' GROUP BY order_id HAVING MIN(created_at)>=${from} AND MIN(created_at)<=${asOf}) h ON h.order_id=o.id WHERE o.status='COMPLETED' AND o.payment_status='PAID' AND o.payment_method IN ('ONLINE_CARD','CASH_ON_DELIVERY')`;
        type Daily = {
          day: string;
          createdOrders: bigint;
          unlinkedOrders: bigint;
          completedOrders: bigint;
          onlineRevenue: bigint;
          codRevenue: bigint;
        };
        const daily = await tx.$queryRaw<Daily[]>(Prisma.sql`
    WITH completed AS (${completed}), created AS (
     SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date AS day,COUNT(*) AS count,COUNT(*) FILTER(WHERE user_id IS NULL) AS guests FROM orders WHERE created_at>=${from} AND created_at<=${asOf} GROUP BY 1
    ), sold AS (
     SELECT (at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date AS day,COUNT(*) AS count,COALESCE(SUM(total) FILTER(WHERE payment_method='ONLINE_CARD'),0) AS online,COALESCE(SUM(total) FILTER(WHERE payment_method='CASH_ON_DELIVERY'),0) AS cod FROM completed GROUP BY 1
    )
    SELECT d.day::date::text AS day,COALESCE(c.count,0)::bigint AS "createdOrders",COALESCE(c.guests,0)::bigint AS "unlinkedOrders",COALESCE(s.count,0)::bigint AS "completedOrders",COALESCE(s.online,0)::bigint AS "onlineRevenue",COALESCE(s.cod,0)::bigint AS "codRevenue"
    FROM generate_series((${from}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Kyiv')::date,(${asOf.toISOString()}::timestamptz AT TIME ZONE 'Europe/Kyiv')::date,interval '1 day') d(day) LEFT JOIN created c ON c.day=d.day::date LEFT JOIN sold s ON s.day=d.day::date ORDER BY d.day
   `);
        const series: DashboardDay[] = daily.map((x) => ({
          day: x.day,
          createdOrders: reportNumber(x.createdOrders),
          unlinkedOrders: reportNumber(x.unlinkedOrders),
          completedOrders: reportNumber(x.completedOrders),
          onlineRevenue: reportNumber(x.onlineRevenue),
          codRevenue: reportNumber(x.codRevenue),
        }));
        type Top = {
          productId: string;
          name: string;
          unit: 'GRAM' | 'PIECE';
          quantity: bigint;
          revenue: bigint;
        };
        const top = await tx.$queryRaw<Top[]>(
          Prisma.sql`WITH completed AS (${completed}) SELECT item->>'productId' AS "productId",(array_agg(item->>'name' ORDER BY c.at DESC,c.id))[1] AS name,CASE WHEN item->>'weightGrams' IS NULL THEN 'PIECE' ELSE 'GRAM' END AS unit,SUM((item->>'quantity')::bigint * COALESCE((item->>'weightGrams')::bigint,1))::bigint AS quantity,SUM((item->>'quantity')::bigint * (item->>'unitPrice')::bigint)::bigint AS revenue FROM completed c CROSS JOIN LATERAL jsonb_array_elements(c.items) item GROUP BY 1,3 ORDER BY revenue DESC,"productId",unit LIMIT 10`,
        );
        const sum = (key: Exclude<keyof DashboardDay, 'day'>) =>
          reportNumber(series.reduce((n, x) => n + x[key], 0));
        const onlineRevenue = sum('onlineRevenue'),
          codRevenue = sum('codRevenue'),
          completedOrders = sum('completedOrders');
        return {
          from: from.toISOString(),
          asOf: asOf.toISOString(),
          days,
          createdOrders: sum('createdOrders'),
          unlinkedOrders: sum('unlinkedOrders'),
          completedOrders,
          onlineRevenue,
          codRevenue,
          averageOrder: completedOrders
            ? Math.floor(reportNumber(onlineRevenue + codRevenue) / completedOrders)
            : 0,
          series,
          topProducts: top.map((x) => ({
            ...x,
            quantity: reportNumber(x.quantity),
            revenue: reportNumber(x.revenue),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10000 },
    );
  }
}
