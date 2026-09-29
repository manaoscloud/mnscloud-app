# Global contextual field help migration

The App uses one shared inline help component. The inventory found all legacy
field-hint renderers in the generic CRUD template, fed by the following consumers.

| Consumer | Static help | Conditional help |
| --- | ---: | ---: |
| `src/app/pages/system/pay/bank-partners/bank-partners-crud.ts` | 5 | 2 |
| `src/app/pages/erp/financial/payment/gateway/payment-gateway-crud.ts` | 2 | 1 |
| `src/app/pages/hosting/vps/instances/instances.ts` | 2 | 0 |
| `src/app/pages/hosting/vps/networks/networks.ts` | 1 | 2 |
| `src/app/pages/hosting/vps/firewalls/firewalls.ts` | 2 | 0 |
| `src/app/pages/monitoring/notification-rules/notification-rules.ts` | 3 | 0 |
| `src/app/pages/voip/pabx/server/server.ts` | 5 | 1 |
| `src/app/pages/hosting/dns/domains/domains.ts` | 5 | 0 |

All generic CRUD pages inherit the renderer, including quick-create and collection dialogs.
Address and inline related-collection editors use the same suffix control. Native file
uploads retain their border, selected-file status and upload semantics, with help inside
the outline. Password visibility, select arrows and FK quick-create remain separate actions.

The DNS publication prerequisite moved into that field's help; its detached notice and
the pilot opt-in contract were removed. `help` and `helpWhen` are the canonical metadata.
An empty conditional result hides the button, and related drafts use their own values.

The scan also found dashboard metric `hint` values and a clinical attachment dialog's
`.hint` styling. Those are separate components, not field-hint consumers, and retain their
existing behavior. Validation errors and operational states are not supplementary help.

Validation covers the eight consumers with CRUD/layout/i18n validators, production build,
conditional guidance unit tests, suffix interaction tests and browser checks across both
themes, responsive widths and PT/EN/ES. Runtime delivery uses the App release pipeline and
enrolled Agents. See `app.md` for the reusable contract.
