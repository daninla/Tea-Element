---
name: guest-order-access
description: Use when touching orders, checkout, order tracking, account registration after an order, or linking guest orders to a user account.
---

# Guest orders

Read SPEC.md sections 7 and 8.1 first.

## Rules
1. `orders.user_id` is nullable. All order code must handle guests (`user_id = null`).
2. Contacts (first/last name, phone, email) and delivery are stored as a snapshot inside the order.
3. Guest access to an order requires the `accessToken` (32+ random bytes). Store only its hash. Compare timing-safely. NEVER return order data by order number alone.
4. Order lookup form (number + email): rate limited, identical response whether or not the order exists.
5. Prices, discounts and totals are always recalculated on the server; never trust amounts from the client. Use an `Idempotency-Key` to prevent duplicate orders.
6. `POST /auth/register-from-order`: requires valid number + token; takes email and name from the order; user sets only a password.
7. Link older guest orders to an account ONLY after `UserEmailVerified` for the same email.
8. Marketing consent is a separate unchecked checkbox; store `marketing_consent_at`. Without consent, use the email only for transactional messages.

## Tests required
Wrong or missing token returns 404/403; another user's order is not accessible; linking before email verification does not happen; duplicate submit creates one order.
