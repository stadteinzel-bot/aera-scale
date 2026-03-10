"use strict";
// ===== AERA SCALE — Cloud Functions Entry Point =====
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyInvoices = exports.sendExpiryReminders = exports.deleteAccount = exports.tinkSyncTransactions = exports.tinkHandleCallback = exports.tinkCreateLink = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Tink Open Banking integration (replaces GoCardless — new signups disabled)
var tink_1 = require("./tink");
Object.defineProperty(exports, "tinkCreateLink", { enumerable: true, get: function () { return tink_1.tinkCreateLink; } });
Object.defineProperty(exports, "tinkHandleCallback", { enumerable: true, get: function () { return tink_1.tinkHandleCallback; } });
Object.defineProperty(exports, "tinkSyncTransactions", { enumerable: true, get: function () { return tink_1.tinkSyncTransactions; } });
// Account management (self-service account deletion)
var account_1 = require("./account");
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return account_1.deleteAccount; } });
// Scheduled: daily expiry reminders → writes to `mail` collection (Trigger Email extension)
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "sendExpiryReminders", { enumerable: true, get: function () { return notifications_1.sendExpiryReminders; } });
// Scheduled: 1st of every month → auto-generates rent invoices from active contracts
var invoiceScheduler_1 = require("./invoiceScheduler");
Object.defineProperty(exports, "generateMonthlyInvoices", { enumerable: true, get: function () { return invoiceScheduler_1.generateMonthlyInvoices; } });
//# sourceMappingURL=index.js.map