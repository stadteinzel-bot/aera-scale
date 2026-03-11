
// Global navigation views (slim sidebar)
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PROPERTIES = 'PROPERTIES',
  TENANTS = 'TENANTS',
  FINANCE = 'FINANCE',
  SETTINGS = 'SETTINGS',
  // System / special views
  TENANT_PORTAL = 'TENANT_PORTAL',
  HEALTH = 'HEALTH',
  DEBUG = 'DEBUG',
}

// Asset-scoped sub-navigation tabs (shown inside AssetLayout)
export enum AssetTab {
  OVERVIEW = 'OVERVIEW',
  CALENDAR = 'CALENDAR',
  TENANTS = 'TENANTS',
  UNITS = 'UNITS',
  MAINTENANCE = 'MAINTENANCE',
  MESSAGES = 'MESSAGES',
  DOCUMENTS = 'DOCUMENTS',
  OPERATING_COSTS = 'OPERATING_COSTS',
  SERVICE_CHARGES = 'SERVICE_CHARGES',
  RENT_INVOICES = 'RENT_INVOICES',
  AI_AUTOMATION = 'AI_AUTOMATION',
  RECONCILIATION = 'RECONCILIATION',
  CONFIG = 'CONFIG',
}

// ── Multi-Tenant Organisation ──

export type OrgRole = 'org_admin' | 'user' | 'finance' | 'property_manager';
export type MemberStatus = 'pending' | 'active' | 'deactivated';

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  onboardingComplete: boolean;
  /** Subscription plan — controls feature access. Default: 'basic' */
  plan?: 'basic' | 'pro' | 'enterprise';
  /** Storage plan tier — determines upload quota. Default: 'basic' */
  storagePlan?: 'basic' | 'pro' | 'enterprise';
  /** Running total of uploaded bytes tracked by storageQuota service */
  storageUsedBytes?: number;
}


export interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: OrgRole;
  status: MemberStatus;
  invitedAt: string;
  invitedBy: string;
  activatedAt?: string;
}

export interface RentPayment {
  id: string;
  date: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Late';
  period: string;
}

export interface PropertyUnit {
  id: string;
  unitNumber: string;
  sizeSqFt: number;
  rentMonthly: number;
  status: 'Occupied' | 'Vacant' | 'Maintenance';
  floor?: string;
  rentHistory?: RentPayment[];
}

export interface Landlord {
  name: string;         // Firma oder Personenname
  address: string;      // Straße + Hausnummer
  zipCode: string;      // PLZ
  city: string;         // Ort
  email: string;        // E-Mail
  phone?: string;       // Telefon (optional)
  iban: string;         // Bankverbindung
  bic?: string;
  bankName?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: 'Office' | 'Retail' | 'Industrial' | 'Mixed Use';
  sizeSqFt: number;
  status: 'Occupied' | 'Vacant' | 'Maintenance';
  rentPerSqFt: number;
  image: string;
  description?: string;
  amenities?: string[];
  units?: PropertyUnit[];
  landlord?: Landlord;
}

export interface Tenant {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  propertyId: string;
  unitId?: string; // Linked Unit
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  status: 'Good Standing' | 'Late' | 'Notice Given';
  leaseContent?: string;
  leaseFileName?: string;
}

export interface MaintenanceTicket {
  id: string;
  tenantId: string;
  propertyId: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  status: 'Open' | 'In Progress' | 'Resolved';
  dateCreated: string;
}

export interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
}

export interface Message {
  id: string;
  propertyId?: string;
  tenantId?: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  isAdmin: boolean;
}

export interface NotificationSettings {
  reminderDaysBefore: number;
  reminderMessage: string;
  overdueDaysAfter: number;
  overdueMessage: string;
  enableReminders: boolean;
  enableOverdueAlerts: boolean;
  businessWhatsappNumber: string;
}

export interface BankSettings {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
  enableAutoReconciliation: boolean;
  matchThreshold: number; // Percentage match for name detection
}

export interface ReconciliationResult {
  transactionId: string;
  originalAmount: number;
  senderName: string;
  status: 'Matched' | 'Unmatched' | 'Partial Payment' | 'Overpayment';
  matchedTenantName?: string;
  confidenceScore: number; // 0-100
  reasoning: string;
  discrepancyAmount?: number;
}

export type DocumentType = 'Mietvertrag' | 'Energieausweis' | 'Grundbuchauszug' | 'Übergabeprotokoll' | 'Nebenkostenabrechnung' | 'Sonstige';

export interface PropertyDocument {
  id: string;
  propertyId: string;
  tenantId?: string;
  name: string;
  type: DocumentType;
  fileUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  expiresAt?: string;
  notes?: string;
  aiAnalysis?: string;
}

export type CostCategory =
  | 'Heizung' | 'Wasser' | 'Strom' | 'Müllabfuhr' | 'Hausmeister'
  | 'Gebäudeversicherung' | 'Grundsteuer' | 'Aufzug' | 'Gartenpflege'
  | 'Reinigung' | 'Schornsteinfeger' | 'Allgemeinstrom' | 'Sonstige';

export interface OperatingCostEntry {
  id: string;
  propertyId: string;
  category: CostCategory;
  amount: number;
  period: string;       // e.g. '2025-01' for Jan 2025
  year: number;
  description?: string;
  invoiceRef?: string;  // reference number
  createdAt: string;
}

export type AllocationKeyType = 'flaeche' | 'personenzahl' | 'einheiten' | 'verbrauch' | 'direkt';

export interface AllocationConfig {
  category: CostCategory;
  keyType: AllocationKeyType;
  label: string; // e.g. "Nach Wohnfläche"
}

export interface CostLineItem {
  category: CostCategory;
  totalAmount: number;
  keyType: AllocationKeyType;
  tenantShare: number;     // calculated share for this tenant
  sharePercentage: number; // e.g. 35.5%
}

export interface TenantSettlement {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  unitSize: number;        // sqm
  occupancyDays: number;   // days in period
  totalDays: number;       // total days in period
  proRataFactor: number;   // occupancy ratio
  costItems: CostLineItem[];
  totalCosts: number;
  prepayments: number;     // Vorauszahlungen
  balance: number;         // + = Nachzahlung, - = Guthaben
}

export interface Settlement {
  id: string;
  propertyId: string;
  year: number;
  periodStart: string;
  periodEnd: string;
  tenantSettlements: TenantSettlement[];
  totalPropertyCosts: number;
  status: 'draft' | 'validated' | 'sent';
  aiValidation?: string;
  createdAt: string;
  generatedText?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type PaymentMethod = 'Überweisung' | 'Lastschrift' | 'Bar' | 'Sonstige';

export interface RentInvoice {
  id: string;
  tenantId: string;
  propertyId: string;
  invoiceNumber: string;    // RE-2025-0001
  period: string;           // 2025-01
  dueDate: string;          // ISO date
  kaltmiete: number;
  nebenkostenVorauszahlung: number;
  totalAmount: number;
  status: InvoiceStatus;
  paidAmount: number;
  paidDate?: string;
  remindersSent: number;
  lastReminderDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId?: string;       // linked invoice
  tenantId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;       // bank reference / Verwendungszweck
  isAutoMatched: boolean;
  matchConfidence?: number; // 0-100 if auto-matched
  notes?: string;
  createdAt: string;
}

// ── Asset-level configuration (per property) ──

export interface AssetBankOverride {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
}

export interface AssetNotificationConfig {
  enableReminders: boolean;
  reminderDaysBefore: number;
  reminderTemplate: string;
  enableOverdueAlerts: boolean;
  overdueDaysAfter: number;
  overdueTemplate: string;
}

export interface AssetWhatsAppConfig {
  mode: 'global' | 'override';
  overrideNumber: string;
}

export interface AssetConfig {
  propertyId: string;
  bankOverride?: AssetBankOverride;
  aiPaymentEnabled: boolean;
  aiMatchThreshold: number;
  aiPartialPaymentTolerance: number;
  notifications: AssetNotificationConfig;
  whatsapp: AssetWhatsAppConfig;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  propertyId: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  user?: string;
  timestamp?: string;
  userEmail?: string;
}
