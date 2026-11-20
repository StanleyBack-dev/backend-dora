import type { AppErrorDefinition } from "@/common/exceptions/app-error-definition.type";
import { accessControlErrors } from "@/common/exceptions/catalogs/access-control-errors.catalog";
import { auditErrors } from "@/common/exceptions/catalogs/audit-errors.catalog";
import { authErrors } from "@/common/exceptions/catalogs/auth-errors.catalog";
import { condominiumsErrors } from "@/common/exceptions/catalogs/condominiums-errors.catalog";
import { bookingsErrors } from "@/common/exceptions/catalogs/bookings-errors.catalog";
import { broadcastsErrors } from "@/common/exceptions/catalogs/broadcasts-errors.catalog";
import { enrollmentErrors } from "@/common/exceptions/catalogs/enrollment-errors.catalog";
import { eventsErrors } from "@/common/exceptions/catalogs/events-errors.catalog";
import { dependentsErrors } from "@/common/exceptions/catalogs/dependents-errors.catalog";
import { identityErrors } from "@/common/exceptions/catalogs/identity-errors.catalog";
import { landingErrors } from "@/common/exceptions/catalogs/landing-errors.catalog";
import { mailsErrors } from "@/common/exceptions/catalogs/mails-errors.catalog";
import { platformMetricsErrors } from "@/common/exceptions/catalogs/platform-metrics-errors.catalog";
import { notificationsErrors } from "@/common/exceptions/catalogs/notifications-errors.catalog";
import { lostFoundErrors } from "@/common/exceptions/catalogs/lost-found-errors.catalog";
import { parcelsErrors } from "@/common/exceptions/catalogs/parcels-errors.catalog";
import { spacesErrors } from "@/common/exceptions/catalogs/spaces-errors.catalog";
import { storageErrors } from "@/common/exceptions/catalogs/storage-errors.catalog";
import { supportErrors } from "@/common/exceptions/catalogs/support-errors.catalog";
import { supportersErrors } from "@/common/exceptions/catalogs/supporters-errors.catalog";
import { tenancyErrors } from "@/common/exceptions/catalogs/tenancy-errors.catalog";

export const APP_ERRORS = {
  accessControl: accessControlErrors,
  audit: auditErrors,
  auth: authErrors,
  bookings: bookingsErrors,
  broadcasts: broadcastsErrors,
  condominiums: condominiumsErrors,
  enrollment: enrollmentErrors,
  events: eventsErrors,
  dependents: dependentsErrors,
  identity: identityErrors,
  landing: landingErrors,
  mails: mailsErrors,
  notifications: notificationsErrors,
  parcels: parcelsErrors,
  lostFound: lostFoundErrors,
  platformMetrics: platformMetricsErrors,
  spaces: spacesErrors,
  storage: storageErrors,
  support: supportErrors,
  supporters: supportersErrors,
  tenancy: tenancyErrors,
} as const satisfies Record<string, Record<string, AppErrorDefinition<never>>>;
