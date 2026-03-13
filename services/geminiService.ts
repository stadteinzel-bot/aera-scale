import { getGenerativeModel, SchemaType } from "firebase/ai";
import { ai } from "./firebaseConfig";
import { ReconciliationResult } from "../types";

// Local types for AI responses
export interface LiabilityResult {
  responsibleParty: 'Landlord' | 'Tenant' | 'Shared/Ambiguous';
  confidence: number;
  reasoning: string;
  clauseCitation: string;
}

export interface PropertyDetails {
  name?: string;
  address?: string;
  type?: string;
  description?: string;
  amenities?: string[];
  marketRent?: number;
}

export interface MaintenanceAnalysis {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  category: string;
}

export interface ScenarioResult {
  simulatedData: { month: string, revenue: number, expenses: number }[];
  analysis: string;
  impact: 'Positive' | 'Negative' | 'Neutral';
}

// Helper to get GenAI Model
// Uses Firebase Vertex AI instance directly
export const getModel = (modelName: string = 'gemini-1.5-pro') => {
  if (!ai) {
    throw new Error("Vertex AI Client Not Initialized. Check 'firebaseConfig.ts' and ensure 'VITE_FIREBASE_PROJECT_ID' is set.");
  }
  return getGenerativeModel(ai, { model: modelName });
};

// Check if AI is available
// Checks if the Vertex AI instance was successfully initialized in firebaseConfig
export const hasApiKey = () => !!ai;

export const analyzeLeaseDocument = async (input: string | { mimeType: string; data: string }): Promise<string> => {
  const model = getModel('gemini-2.0-flash');
  if (!model) return "AI Service Unavailable. Please check configuration.";

  try {
    const parts: any[] = [];
    parts.push({
      text: `
        You are the AREA SCALE Legal AI. 
        Analyze the provided lease document (provided as text or file attachment) and provide a risk assessment.
        
        Focus on:
        1. Unusual clauses or tenant-favorable terms that might hurt the landlord.
        2. Key dates and escalation clauses.
        3. Maintenance responsibilities ambiguity.
        
        Format the output in clear Markdown with headers.
    `});

    if (typeof input === 'string') {
      parts.push({ text: `Lease Text Extract:\n"${input}"` });
    } else {
      parts.push({ text: "Attached Lease Document:" });
      parts.push({ inlineData: { mimeType: input.mimeType, data: input.data } });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    }); // Fixed structure for generateContent
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Lease Analysis Error:", error);
    return "Failed to analyze document. Please try again. Note: PDF files are best supported.";
  }
};

export const getLeaseSuggestions = async (leaseText: string): Promise<string> => {
  const model = getModel();
  if (!model) return "AI Service Unavailable.";

  try {
    const result = await model.generateContent(`
        You are the AREA SCALE Predictive Analytics Engine.
        Analyze the following lease text and provide strategic suggestions for the property manager.

        Lease Text: "${leaseText.substring(0, 15000)}"

        Output Format (Markdown):
        ### 💡 Automated Optimization
        (3 bullet points on how to improve the lease terms, increase value, or manage the tenant better in the future)

        ### ⚠️ Risk Predictive System
        (2 bullet points on potential risks, liability gaps, or ambiguous clauses in the current text)

        ### 📝 Executive Summary
        (Brief summary of the lease type and critical obligations)
      `);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Lease Suggestions Error:", error);
    return "Failed to generate suggestions.";
  }
};

export const draftMaintenanceResponse = async (ticketDetails: string, tone: 'Professional' | 'Empathetic' | 'Firm'): Promise<string> => {
  const model = getModel();
  if (!model) return "AI Service Unavailable.";

  try {
    const result = await model.generateContent(`
        You are a property manager at AREA SCALE. Draft a reply to a tenant regarding the following maintenance ticket.
        
        Ticket Details: "${ticketDetails}"
        
        Tone: ${tone}
        
        The reply should acknowledge the issue, provide a brief status update (assume we are scheduling a technician), and be concise.
      `);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Drafting Error:", error);
    return "Error drafting response.";
  }
};

export const generateLeaseDocument = async (
  docType: string,
  tenantName: string,
  propertyAddress: string,
  details: Record<string, any>,
  landlordInfo?: { name?: string; address?: string; email?: string; iban?: string; bankName?: string }
): Promise<string> => {
  const model = getModel();
  if (!model) return "AI Service Unavailable.";

  const detailsString = Object.entries(details)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const llName = landlordInfo?.name || 'Die Hausverwaltung';
  const llAddr = landlordInfo?.address || '';
  const llEmail = landlordInfo?.email || '';
  const llIban = landlordInfo?.iban || '';
  const llBank = landlordInfo?.bankName || '';

  try {
    const result = await model.generateContent(`
        Du bist der Dokumenten-Generator von AERA SCALE.
        
        Aufgabe: Erstelle ein professionelles "${docType}" Dokument auf Deutsch.
        
        Vertragsparteien:
        - Vermieter: ${llName}${llAddr ? `\n          Anschrift: ${llAddr}` : ''}${llEmail ? `\n          E-Mail: ${llEmail}` : ''}
        - Mieter: ${tenantName}
        
        Mietobjekt: ${propertyAddress}
        ${llIban ? `\n        Bankverbindung Vermieter:\n        - IBAN: ${llIban}${llBank ? `\n        - Bank: ${llBank}` : ''}` : ''}
        
        Vertragsbedingungen:
        ${detailsString}
        
        Anweisungen:
        - Verwende professionelle, juristische aber verständliche Sprache auf Deutsch.
        - Füge standardmäßige Vertragsklauseln ein, die für ein "${docType}" Dokument relevant sind.
        - Formatiere mit klaren Abschnittsüberschriften.
        - Keine Markdown-Codeblöcke (kein \`\`\`), nur reinen Text.
        - Verwende das korrekte deutsche Mietrecht (BGB).
      `);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Drafting Error:", error);
    return "Fehler bei der Dokumentenerstellung.";
  }
};

export const generateExecutiveBriefing = async (title: string, rawContent: string, type: 'Maintenance' | 'Announcement'): Promise<string> => {
  const model = getModel();
  if (!model) return "AI Service Unavailable.";

  try {
    const result = await model.generateContent(`
        Act as a Corporate Communications Director for "AREA SCALE".
        
        Task: Rewrite the following raw update into a polished, professional executive briefing paragraph suitable for a decision intelligence dashboard.
        
        Input Type: ${type}
        Title: "${title}"
        Raw Content: "${rawContent}"
        
        Guidelines:
        - If it's maintenance: Sound proactive, reassuring, and detail-oriented. Mention that steps are being taken.
        - If it's announcement: Sound authoritative, clear, and welcoming.
        - Length: 2-3 sophisticated sentences.
        - Do NOT use markdown. Just plain text.
      `);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Briefing Error:", error);
    return rawContent;
  }
};

export const determineMaintenanceLiability = async (ticketTitle: string, ticketDescription: string): Promise<LiabilityResult> => {
  const model = getModel();
  if (!model) {
    return {
      responsibleParty: 'Shared/Ambiguous',
      confidence: 0,
      reasoning: "AI Service Unavailable.",
      clauseCitation: "N/A"
    };
  }

  const simulatedLeaseContext = `
    ARTICLE 7: REPAIRS AND MAINTENANCE
    7.1 Landlord's Obligations. Landlord shall keep the foundation, roof, and structural portions of the exterior walls of the Building in good order, condition and repair. Landlord shall also maintain the Building's core HVAC systems.
    7.2 Tenant's Obligations. Tenant shall, at Tenant's sole cost and expense, keep the Premises in good order, condition and repair, including but not limited to, interior walls, ceilings, floors, windows, doors, fixtures, and any supplemental HVAC units installed by Tenant. Tenant is responsible for all plumbing stoppages caused by Tenant's use.
  `;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `
        Act as a Legal Liability Arbiter for a commercial lease under AREA SCALE protocols.
        
        Task: Determine who is financially responsible for the following maintenance issue based on the Lease Clauses provided.
        
        Maintenance Issue:
        Title: "${ticketTitle}"
        Description: "${ticketDescription}"
        
        Lease Clauses:
        "${simulatedLeaseContext}"
        
        Analyze the issue against the clauses. 
        If it's structural or core HVAC, it is likely Landlord.
        If it's interior, fixtures, or caused by misuse, it is likely Tenant.
        
        Return the result in JSON format.
      `}]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            responsibleParty: { type: SchemaType.STRING, enum: ["Landlord", "Tenant", "Shared/Ambiguous"] },
            confidence: { type: SchemaType.NUMBER, description: "Confidence score between 0 and 100" },
            reasoning: { type: SchemaType.STRING, description: "Brief legal explanation of why" },
            clauseCitation: { type: SchemaType.STRING, description: "The specific text from the lease used to make the decision" }
          }
        }
      }
    });

    const response = await result.response;
    return JSON.parse(response.text()) as LiabilityResult;
  } catch (error) {
    console.error("Vertex AI Liability Analysis Error:", error);
    return {
      responsibleParty: 'Shared/Ambiguous',
      confidence: 0,
      reasoning: "AI analysis failed.",
      clauseCitation: "Error"
    };
  }
};

export const findPropertyDetails = async (query: string): Promise<PropertyDetails | null> => {
  const model = getModel();
  if (!model) return null;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `
        Act as a real estate analyst for AREA SCALE.
        Generate plausible commercial property details for a property matching: "${query}".
        
        Ensure the data is realistic for the location.
        `
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: "Official name of the place or building" },
            address: { type: SchemaType.STRING, description: "Full formatted address" },
            type: { type: SchemaType.STRING, enum: ["Office", "Retail", "Industrial", "Mixed Use"] },
            description: { type: SchemaType.STRING, description: "Professional marketing description" },
            amenities: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "List of 3-5 likely amenities"
            },
            marketRent: { type: SchemaType.NUMBER, description: "Estimated rent per square meter (Euro)" }
          },
          required: ["name", "address", "type", "description", "amenities", "marketRent"]
        }
      }
    });

    const response = await result.response;
    return JSON.parse(response.text()) as PropertyDetails;
  } catch (error) {
    console.error("Vertex AI Search Error:", error);
    throw error; // Re-throw to allow UI to handle specific error messages
  }
};

export const analyzeMaintenanceImage = async (base64Data: string, mimeType: string): Promise<MaintenanceAnalysis | null> => {
  const model = getModel();
  if (!model) return null;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: "Act as an AREA SCALE Facility AI. Analyze the attached maintenance image. Identify the defect or issue. Generate a professional ticket title, a clear and detailed description of the visual evidence, assess the urgency/priority based on potential safety or property damage risks (Low/Medium/High/Emergency), and categorize the trade (e.g. Plumbing, HVAC, etc). Return JSON." },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            priority: { type: SchemaType.STRING, enum: ["Low", "Medium", "High", "Emergency"] },
            category: { type: SchemaType.STRING }
          }
        }
      }
    });

    const response = await result.response;
    return JSON.parse(response.text()) as MaintenanceAnalysis;
  } catch (error) {
    console.error("Vertex AI Image Analysis Error:", error);
    return null;
  }
};

export const getTenantAssistantResponse = async (history: { role: 'user' | 'model', parts: { text: string }[] }[], newMessage: string): Promise<string> => {
  const model = getModel();
  if (!model) return "Assistant unavailable.";

  const chat = model.startChat({
    history: history as any, // Cast history to satisfy type if needed, or map it. Vertex SDK uses similar structure.
    systemInstruction: `You are a helpful virtual assistant for "AREA SCALE". You help tenants (specifically Acme Corp) with questions about their lease, maintenance, and building policies.
      
      Tenant Context:
      - Name: Acme Corp
      - Rent: €45,000/mo
      - Lease End: 2027-01-01
      - Building: Skyline Tower
      
      Policies:
      - Noise: Quiet hours 8PM-7AM.
      - Guests: Must check in at lobby.
      - Parking: 20 reserved spots included.
      
      Keep answers concise and professional.`,
  });

  try {
    const result = await chat.sendMessage(newMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Vertex AI Chat Error:", error);
    return "I'm having trouble connecting right now. Please try again later.";
  }
};

export const generateScenarioSimulation = async (currentData: any[], scenario: string): Promise<ScenarioResult | null> => {
  const model = getModel();
  if (!model) return null;

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user', parts: [{
          text: `
                Act as the Decision Intelligence Engine for AREA SCALE.
                
                Current Revenue Data (JSON): ${JSON.stringify(currentData)}
                
                User "What-if" Scenario: "${scenario}"
                
                Task:
                1. Modify the revenue/expenses data to reflect the scenario.
                2. Provide a brief strategic analysis of the impact.
                
                Return JSON format:
                {
                    "simulatedData": [{"month": "Jan", "revenue": 123, "expenses": 456}, ...],
                    "analysis": "Brief text explanation...",
                    "impact": "Positive" | "Negative" | "Neutral"
                }
            `}]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            simulatedData: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  month: { type: SchemaType.STRING },
                  revenue: { type: SchemaType.NUMBER },
                  expenses: { type: SchemaType.NUMBER }
                }
              }
            },
            analysis: { type: SchemaType.STRING },
            impact: { type: SchemaType.STRING, enum: ["Positive", "Negative", "Neutral"] }
          }
        }
      }
    });

    const response = await result.response;
    return JSON.parse(response.text()) as ScenarioResult;
  } catch (error) {
    console.error("Vertex AI Simulation Error:", error);
    return null;
  }
};

// --- NEW FUNCTION FOR BANK RECONCILIATION ---
export const performSmartReconciliation = async (
  transactions: { id: string, amount: number, sender: string, reference: string }[],
  tenants: { name: string, monthlyRent: number }[]
): Promise<ReconciliationResult[]> => {
  const model = getModel();
  if (!model) return [];

  try {
    const result = await model.generateContent({
      contents: [{
        role: 'user', parts: [{
          text: `
                Act as the AREA SCALE Automation Auditor.
                
                Your Task: Reconcile bank transactions against a list of tenants and their expected monthly rent.
                
                Tenants: ${JSON.stringify(tenants)}
                Transactions: ${JSON.stringify(transactions)}
                
                Analysis Rules:
                1. Match Logic: Look for tenant names (fuzzy match), company variations, or references in the transaction.
                2. Amount Check: Compare transaction amount vs. tenant's monthlyRent.
                   - Exact match = "Matched"
                   - Less than rent = "Partial Payment"
                   - More than rent = "Overpayment"
                   - No tenant found = "Unmatched"
                3. Confidence: Assign a score (0-100) based on how strong the name/reference match is.
                
                Return a JSON Array of results.
            `}]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              transactionId: { type: SchemaType.STRING },
              originalAmount: { type: SchemaType.NUMBER },
              senderName: { type: SchemaType.STRING },
              status: { type: SchemaType.STRING, enum: ["Matched", "Unmatched", "Partial Payment", "Overpayment"] },
              matchedTenantName: { type: SchemaType.STRING },
              confidenceScore: { type: SchemaType.NUMBER },
              reasoning: { type: SchemaType.STRING },
              discrepancyAmount: { type: SchemaType.NUMBER }
            }
          }
        }
      }
    });

    const response = await result.response;
    return JSON.parse(response.text()) as ReconciliationResult[];
  } catch (error) {
    console.error("Vertex AI Smart Reconciliation Error:", error);
    return [];
  }
};

// --- AI OPERATING COST ANALYSIS ---
export const analyzeOperatingCosts = async (
  propertyName: string,
  propertySizeSqm: number,
  costData: { category: string; amount: number; period: string }[]
): Promise<string> => {
  const model = getModel();
  if (!model) throw new Error('AI model not available');

  const costSummary = costData.map(c => `${c.category}: ${c.amount.toFixed(2)}€ (${c.period})`).join('\n');
  const totalCosts = costData.reduce((sum, c) => sum + c.amount, 0);
  const costPerSqm = propertySizeSqm > 0 ? (totalCosts / propertySizeSqm).toFixed(2) : 'N/A';

  const prompt = `Du bist ein Experte für Immobilien-Betriebskosten in Deutschland. Analysiere die folgenden Betriebskosten und gib eine detaillierte Auswertung.

**Immobilie:** ${propertyName}
**Fläche:** ${propertySizeSqm} m²
**Gesamtkosten:** ${totalCosts.toFixed(2)}€
**Kosten pro m²:** ${costPerSqm}€/m²

**Kostenaufstellung:**
${costSummary}

Bitte liefere folgende Analyse auf Deutsch:

1. **📊 Kostenübersicht**: Zusammenfassung der größten Kostentreiber
2. **📈 Benchmarking**: Vergleiche die Kosten/m² mit dem deutschen Durchschnitt (~3,50-4,50€/m² warm)
3. **💡 Optimierungspotenzial**: Konkrete Vorschläge zur Kostenreduzierung mit geschätztem Einsparpotenzial in Euro
4. **⚠️ Auffälligkeiten**: Ungewöhnlich hohe oder niedrige Posten
5. **🔮 Prognose**: Erwartete Kostenentwicklung basierend auf aktuellen Markttrends

Antworte klar strukturiert mit Markdown. Gib konkrete Euro-Beträge für Einsparpotenziale an.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
};

// --- INVOICE OCR / ANALYSIS ---
export const analyzeInvoiceImage = async (
  base64Data: string,
  mimeType: string
): Promise<{ category: string; amount: number; period: string; vendor: string; description: string } | null> => {
  const model = getModel();
  if (!model) return null;

  try {
    const result = await model.generateContent([
      {
        inlineData: { mimeType, data: base64Data }
      },
      `Analysiere diese Rechnung/Beleg und extrahiere die folgenden Informationen im JSON-Format:
{
  "category": "Eine der folgenden Kategorien: Heizung, Wasser, Strom, Müllabfuhr, Hausmeister, Gebäudeversicherung, Grundsteuer, Aufzug, Gartenpflege, Reinigung, Schornsteinfeger, Allgemeinstrom, Sonstige",
  "amount": <Gesamtbetrag als Zahl>,
  "period": "<Abrechnungszeitraum im Format YYYY-MM>",
  "vendor": "<Lieferant/Firma>",
  "description": "<Kurzbeschreibung>"
}
Antworte NUR mit dem JSON-Objekt, kein weiterer Text.`
    ]);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error("Invoice analysis error:", error);
    return null;
  }
};

// --- GENERATE SETTLEMENT DOCUMENT ---
export const generateSettlementDocument = async (
  settlementData: {
    propertyName: string;
    propertyAddress: string;
    year: number;
    periodStart: string;
    periodEnd: string;
    tenantName: string;
    unitSize: number;
    totalPropertySize: number;
    occupancyDays: number;
    totalDays: number;
    costItems: { category: string; totalAmount: number; tenantShare: number; sharePercentage: number; keyType: string }[];
    totalCosts: number;
    prepayments: number;
    balance: number;
    landlordName?: string;
    landlordAddress?: string;
    landlordIban?: string;
  }
): Promise<string> => {
  const model = getModel();
  if (!model) throw new Error('AI model not available');

  const costLines = settlementData.costItems.map(c =>
    `${c.category}: Gesamt ${c.totalAmount.toFixed(2)}€, Anteil ${c.sharePercentage.toFixed(1)}% = ${c.tenantShare.toFixed(2)}€ (Schlüssel: ${c.keyType})`
  ).join('\n');

  const prompt = `Erstelle eine professionelle Nebenkostenabrechnung nach deutschem Mietrecht. Verwende folgende Daten:

**Vermieter-Information:**
${settlementData.landlordName ? `Vermieter: ${settlementData.landlordName}` : ''}
${settlementData.landlordAddress ? `Anschrift: ${settlementData.landlordAddress}` : ''}
Immobilie: ${settlementData.propertyName}
Adresse: ${settlementData.propertyAddress}
${settlementData.landlordIban ? `IBAN: ${settlementData.landlordIban}` : ''}

**Abrechnungszeitraum:** ${settlementData.periodStart} bis ${settlementData.periodEnd}
**Abrechnungsjahr:** ${settlementData.year}

**Mieter:** ${settlementData.tenantName}
**Wohnfläche:** ${settlementData.unitSize} m² von ${settlementData.totalPropertySize} m² gesamt
**Nutzungstage:** ${settlementData.occupancyDays} von ${settlementData.totalDays} Tagen

**Kostenaufstellung:**
${costLines}

**Zusammenfassung:**
- Gesamtanteil Mieter: ${settlementData.totalCosts.toFixed(2)}€
- Geleistete Vorauszahlungen: ${settlementData.prepayments.toFixed(2)}€
- **${settlementData.balance > 0 ? 'NACHZAHLUNG' : 'GUTHABEN'}: ${Math.abs(settlementData.balance).toFixed(2)}€**

Erstelle eine vollständige, rechtskonforme Nebenkostenabrechnung mit:
1. Briefkopf-Bereich (Absender/Empfänger)
2. Betreff und Anrede
3. Einleitung mit Rechtsgrundlage
4. Tabellarische Kostenaufstellung mit Verteilerschlüssel
5. Zusammenfassung (Gesamtkosten, Vorauszahlungen, Ergebnis)
6. Zahlungsaufforderung/Gutschrift-Hinweis
7. Hinweis auf Belegeinsicht (§ 259 BGB)
8. Widerspruchsfrist (12 Monate)

Formatiere als gut lesbares Dokument mit klarer Struktur. Verwende Markdown-Formatierung.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- VALIDATE SETTLEMENT COMPLIANCE ---
export const validateSettlementCompliance = async (
  settlementSummary: string
): Promise<string> => {
  const model = getModel();
  if (!model) throw new Error('AI model not available');

  const prompt = `Du bist ein Experte für deutsches Mietrecht und Betriebskostenrecht. Prüfe die folgende Nebenkostenabrechnung auf rechtliche Konformität:

${settlementSummary}

Prüfe folgende Punkte und gib eine strukturierte Bewertung:

1. **✅ Formelle Anforderungen**
   - Abrechnungszeitraum korrekt (max. 12 Monate)?
   - Abrechnungsfrist eingehalten (§ 556 Abs. 3 BGB)?
   - Gesamtkosten und Einzelpositionen nachvollziehbar?

2. **✅ Umlagefähigkeit (§ 2 BetrKV)**
   - Sind alle aufgeführten Kostenarten umlagefähig?
   - Gibt es nicht umlagefähige Verwaltungs- oder Reparaturkosten?

3. **✅ Verteilerschlüssel**
   - Sind die verwendeten Schlüssel sachgerecht?
   - Heizkosten: 50-70% verbrauchsabhängig (HeizkostenV)?

4. **✅ Wirtschaftlichkeitsgebot (§ 556 Abs. 3 BGB)**
   - Sind die Kosten pro m² im üblichen Rahmen?
   - Gibt es auffällig hohe Einzelpositionen?

5. **⚠️ Risiken & Empfehlungen**
   - Gibt es potenzielle Angriffspunkte für Mieter-Widerspruch?
   - Verbesserungsvorschläge?

Bewerte mit: ✅ Konform, ⚠️ Prüfen, ❌ Problem
Gib am Ende eine Gesamtbewertung (1-10 Punkte, 10 = perfekt konform).`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- DUNNING LETTER (MAHNSCHREIBEN) ---
export const generateDunningLetter = async (
  tenantName: string,
  address: string,
  invoiceDetails: { invoiceNumber: string; period: string; totalAmount: number; dueDate: string; outstandingAmount: number },
  level: 1 | 2 | 3, // 1 = Zahlungserinnerung, 2 = Mahnung, 3 = Letzte Mahnung
  landlordName?: string
): Promise<string> => {
  const model = getModel();
  if (!model) throw new Error('AI model not available');

  const levelNames = { 1: 'freundliche Zahlungserinnerung', 2: 'Mahnung', 3: 'letzte Mahnung vor rechtlichen Schritten' };
  const levelTone = { 1: 'freundlich und höflich', 2: 'bestimmt aber sachlich', 3: 'ernst und formal mit Hinweis auf rechtliche Konsequenzen' };

  const prompt = `Erstelle ein professionelles Mahnschreiben auf Deutsch (${levelNames[level]}).

**Ton:** ${levelTone[level]}

**Daten:**
- Vermieter: ${landlordName || 'Die Hausverwaltung'}
- Mieter: ${tenantName}
- Adresse: ${address}
- Rechnungsnummer: ${invoiceDetails.invoiceNumber}
- Abrechnungszeitraum: ${invoiceDetails.period}
- Gesamtbetrag: ${invoiceDetails.totalAmount.toFixed(2)}€
- Fälligkeitsdatum: ${invoiceDetails.dueDate}
- Ausstehender Betrag: ${invoiceDetails.outstandingAmount.toFixed(2)}€

**Niveau ${level}:**
${level === 1 ? '- Höfliche Erinnerung\n- Verweis auf Zahlungstermin\n- Bitte um zeitnahe Überweisung\n- Bankverbindung angeben (Platzhalter)' :
      level === 2 ? '- Formelle Mahnung\n- Hinweis auf Verzug § 286 BGB\n- Fristsetzung (14 Tage)\n- Hinweis auf mögliche Verzugszinsen (5% über Basiszinssatz)' :
        '- Letzte Mahnung\n- Androhung rechtlicher Schritte (Mahnbescheid)\n- Letzte Frist (7 Tage)\n- Hinweis auf Kündigungsrecht bei 2 Monaten Rückstand (§ 543 Abs. 2 BGB)\n- Hinweis auf Übernahme der Inkassokosten'}

Erstelle das Dokument mit:
1. Absender/Empfänger-Bereich
2. Datum
3. Betreff
4. Anrede
5. Haupttext
6. Zahlungsinformationen
7. Grußformel

Formatiere als gut lesbares Markdown-Dokument.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// --- PAYMENT PATTERN ANALYSIS ---
export const analyzePaymentPattern = async (
  tenantName: string,
  paymentHistory: { period: string; dueDate: string; paidDate?: string; amount: number; totalDue: number; status: string }[]
): Promise<string> => {
  const model = getModel();
  if (!model) throw new Error('AI model not available');

  const historyText = paymentHistory.map(p =>
    `${p.period}: Fällig ${p.dueDate}, ${p.paidDate ? `Bezahlt ${p.paidDate}` : 'NICHT BEZAHLT'}, ${p.amount.toFixed(2)}€ von ${p.totalDue.toFixed(2)}€ — Status: ${p.status}`
  ).join('\n');

  const prompt = `Analysiere das Zahlungsverhalten des Mieters "${tenantName}" basierend auf folgender Historie:

${historyText}

Erstelle eine strukturierte Analyse auf Deutsch:

1. **📊 Zahlungsprofil**: Pünktlichkeitsquote, Durchschnittliche Zahlungsverzögerung (Tage)
2. **🎯 Risikobewertung**: Gering / Mittel / Hoch / Kritisch — mit Begründung
3. **📈 Trend**: Wird das Zahlungsverhalten besser oder schlechter?
4. **💡 Empfehlungen**: Konkrete Maßnahmen je nach Risikolevel
5. **🔮 Prognose**: Erwartetes Verhalten in den nächsten 3 Monaten

Bewerte den Mieter auf einer Skala von 1-10 (10 = perfekter Zahler).`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};
