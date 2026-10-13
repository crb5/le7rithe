const actionTranslationKeys: Record<string, string> = {
  'listing.active': 'auditActionListingActive',
  'listing.rejected': 'auditActionListingRejected',
  'listing.suspended': 'auditActionListingSuspended',
  'listing.promote': 'auditActionListingPromoted',
  'listing.delete': 'auditActionListingDeleted',
  'user.active': 'auditActionUserActivated',
  'user.suspended': 'auditActionUserSuspended',
  'user.verified': 'auditActionUserVerified',
  'user.unverified': 'auditActionUserUnverified',
  'payment.confirmed': 'auditActionPaymentConfirmed',
  'payment.rejected': 'auditActionPaymentRejected',
  'payment.proof_viewed': 'auditActionPaymentProofViewed',
  'package.create': 'auditActionPackageCreated',
  'package.update': 'auditActionPackageUpdated',
  'package.delete': 'auditActionPackageDeleted',
  'payment_method.create': 'auditActionPaymentMethodCreated',
  'payment_method.update': 'auditActionPaymentMethodUpdated',
  'payment_method.delete': 'auditActionPaymentMethodDeleted',
  'report.open': 'auditActionReportOpened',
  'report.resolved': 'auditActionReportResolved',
  'banner.create': 'auditActionBannerCreated',
  'banner.update': 'auditActionBannerUpdated',
  'banner.delete': 'auditActionBannerDeleted',
  'support_settings.update': 'auditActionSupportSettingsUpdated',
};

const resourceTranslationKeys: Record<string, string> = {
  listing: 'auditResourceListing',
  user: 'auditResourceUser',
  payment: 'auditResourcePayment',
  package: 'auditResourcePackage',
  payment_method: 'auditResourcePaymentMethod',
  report: 'auditResourceReport',
  banner: 'auditResourceBanner',
  support_settings: 'auditResourceSupportSettings',
};

export function getAdminActionTranslationKey(action: string) {
  return actionTranslationKeys[action];
}

export function getAdminResourceTranslationKey(resourceType: string) {
  return resourceTranslationKeys[resourceType];
}