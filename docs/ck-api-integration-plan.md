# Custom King API Integration Plan

This document captures the transition from the original human-reviewed manufacturing workflow to the direct Custom King integration now in place.

## Current state

- Customer accounts must be `APPROVED` and `ckCustomerVerified = true` before a manufacturing order can be submitted.
- `submitOrder(...)` creates the `Order` (status `SUBMITTED`), then immediately calls `dispatchCustomKingOrder(...)` to place it with Custom King in the same request.
  - On success, the order moves straight to `CK_ORDER_PLACED` with `Order.ckOrderId` / `Order.ckOrderUrl` populated, and a "placed" notification email goes out instead of the plain "submitted" one.
  - On failure (network issue, CK API down, etc.), the order stays `SUBMITTED` and Azzure staff can still push it manually from the admin console via `assignCkOrderId(...)` — the original fallback path.
- The app records:
  - `Order.status`
  - `Order.ckOrderId`
  - `Order.ckOrderUrl`
  - `Order.ckOrderPlacedAt`
  - `OrderEvent` timeline records (tagged `isAdminAction: false` for the automatic dispatch, `true` for a manual admin placement)

## Integration surface

- `submitOrder(...)` is the single app entry point; it dispatches to Custom King behind the scenes so callers don't need to know the upstream transport.
- Admin actions continue to use `assignCkOrderId(...)`, `completeOrder(...)`, and `cancelOrder(...)` — `assignCkOrderId` now takes an `isAdminAction` flag so both the automatic and manual paths share the same code.
- `CUSTOMKING_SANDBOX_MODE=true` (or leaving `CUSTOMKING_API_URL` unset) keeps dispatch on the mock sandbox path for local development, so submitting an order won't hit a real endpoint unless `CUSTOMKING_API_URL` is deliberately configured.

## Notes

- `CK_WEBSITE_URL` is the current placeholder base URL for external links.
- `PRODUCTION_TEAM_EMAIL` is used for operational notifications until customer-facing delivery is defined.
- The existing timeline model is compatible with either manual admin updates or direct API callbacks from Custom King.
