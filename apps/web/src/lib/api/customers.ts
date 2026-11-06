import type {
  CustomerAccount,
  CustomerAccountPage,
  GuestCustomerPage,
  CustomerHistory,
  CustomerSelector,
  CustomerFilters,
} from '@tea/contracts';
import { request } from './orders';
export const customersApi = {
  accounts: (x: CustomerFilters) =>
    request<CustomerAccountPage>(
      '/admin/customers/accounts?' + new URLSearchParams({ page: String(x.page), q: x.q ?? '' }),
    ),
  account: (id: string) =>
    request<CustomerAccount>('/admin/customers/accounts/' + encodeURIComponent(id)),
  guests: (x: CustomerFilters) =>
    request<GuestCustomerPage>(
      '/admin/customers/guests?' + new URLSearchParams({ page: String(x.page), q: x.q ?? '' }),
    ),
  history: (x: CustomerSelector, page: number) =>
    request<CustomerHistory>(
      '/admin/customers/history?' + new URLSearchParams({ ...x, page: String(page) }),
    ),
};
