
import { Property, Tenant, MaintenanceTicket, RevenueData, Message, NotificationSettings } from './types';

// ===== Cross-Domain URLs =====
// Two-domain architecture: Homepage on GitHub Pages, App on Cloud Run
export const HOMEPAGE_BASE = 'https://stadteinzel-bot.github.io/aera-scale/homepage';
export const APP_BASE = 'https://aera-scale-983360724436.europe-west1.run.app';

// ===== PRODUCTION: Mock data removed =====
// The app now reads all data from Firestore.
// These empty arrays are kept for type-safety in fallback paths.

export const MOCK_PROPERTIES: Property[] = [];
export const MOCK_TENANTS: Tenant[] = [];
export const MOCK_TICKETS: MaintenanceTicket[] = [];
export const MOCK_MESSAGES: Message[] = [];

// Revenue chart placeholder - will be replaced by real data from rentEngine
export const REVENUE_DATA: RevenueData[] = [];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  reminderDaysBefore: 3,
  reminderMessage: "Dies ist eine freundliche Erinnerung, dass Ihre Mietzahlung für {Property_Name} in 3 Tagen fällig ist. Bitte stellen Sie sicher, dass die Mittel verfügbar sind.",
  overdueDaysAfter: 5,
  overdueMessage: "DRINGEND: Ihre Mietzahlung für {Property_Name} ist 5 Tage überfällig. Bitte überweisen Sie den Betrag sofort, um Mahngebühren zu vermeiden.",
  enableReminders: true,
  enableOverdueAlerts: true,
  businessWhatsappNumber: ''
};
