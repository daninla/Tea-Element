import type {
  AdminOrderFilters,
  AdminOrderPage,
  AdminOrderDetail,
  AdminOrderTransition,
} from '@tea/contracts';
export abstract class AdminOrdersStore {
  abstract list(filters: AdminOrderFilters): Promise<AdminOrderPage>;
  abstract transition(
    input: AdminOrderTransition,
    actorId: string,
    correlationId: string,
  ): Promise<AdminOrderDetail>;
  abstract detail(id: string): Promise<AdminOrderDetail>;
}
