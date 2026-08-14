# Custom King API Integration Plan

This document captures the transition path from the current internal manufacturing workflow to a direct Custom King integration.

## Current state

- Customer accounts must be `APPROVED` and `ckCustomerVerified = true` before a manufacturing order can be submitted.
- Manufacturing orders are created in the app first, then the queue can be advanced by admins.
- The app records:
  - `Order.status`
  - `Order.ckOrderId`
  - `Order.ckOrderUrl`
  - `Order.ckOrderPlacedAt`
  - `OrderEvent` timeline records

## Near-term integration target

When the Custom King API is available, the order submission flow should:

1. Submit the approved order payload to Custom King.
2. Store the returned CK order identifier in `Order.ckOrderId`.
3. Persist the CK tracking URL in `Order.ckOrderUrl`.
4. Move the order into `CK_ORDER_PLACED`.
5. Emit the workflow email and audit event immediately after the API response.

## Recommended integration surface

- `submitOrder(...)` should remain the app entry point.
- A future `placeOrderWithCk(...)` adapter should live behind the same service layer.
- Admin actions should continue to use `assignCkOrderId(...)`, `completeOrder(...)`, and `cancelOrder(...)` so the UI does not need to know the upstream transport.

## Notes

- `CK_WEBSITE_URL` is the current placeholder base URL for external links.
- `PRODUCTION_TEAM_EMAIL` is used for operational notifications until customer-facing delivery is defined.
- The existing timeline model is compatible with either manual admin updates or direct API callbacks from Custom King.
