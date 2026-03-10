// ===== AERA SCALE — Core Barrel Export =====
// Single import point for all Data Core functionality.

export { DataCoreProvider, useDataCore } from './DataCoreProvider';
export type { DataCoreContextType, DataCoreAction, DashboardKPIs } from './DataCoreProvider';

export { eventBus } from './eventBus';
export type { DataCoreEvent } from './eventBus';

export {
    ENTITY_SCHEMA, STATUS_MAP,
    toUnifiedStatus, resolveFK, getChildren, validateFKIntegrity,
} from './entitySchema';
export type { EntityName, EntityMap, ForeignKeyDef, UnifiedStatus } from './entitySchema';

export {
    computeOccupancyByProperty, computeRevenueHistory,
    computeTenantHealth, computeOperatingCostSummary,
} from './kpiEngine';

export {
    computeTenantRisk, computePropertyRisk, computePortfolioRisk,
} from './riskEngine';
export type { RiskScore, RiskFactor } from './riskEngine';

export {
    generateCashflowForecast, summarizeForecast,
} from './cashflowEngine';
export type { MonthlyForecast, CashflowSummary } from './cashflowEngine';
