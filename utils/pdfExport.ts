import { jsPDF } from 'jspdf';

/**
 * Converts markdown-like text (from AI-generated documents) into a professional PDF.
 * Handles headers (##, ###), bold (**text**), lists (- item), and line wrapping.
 */
export function textToPdf(
    text: string,
    options: {
        title?: string;
        subtitle?: string;
        headerColor?: [number, number, number]; // RGB
        filename?: string;
    } = {}
): jsPDF {
    const {
        title = 'Dokument',
        subtitle,
        headerColor = [15, 82, 70], // aera-primary
    } = options;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const marginL = 20;
    const marginR = 20;
    const contentW = pageW - marginL - marginR;
    const maxY = 272; // leave room for footer
    let y = 0;
    let pageNum = 1;

    const addFooter = () => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.line(marginL, 278, marginL + contentW, 278);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.text('AERA Hausverwaltung GmbH · Erstellt am ' + new Date().toLocaleDateString('de-DE'), pageW / 2, 282, { align: 'center' });
        doc.text(`Seite ${pageNum}`, pageW / 2, 286, { align: 'center' });
    };

    const checkPage = (needed: number) => {
        if (y + needed > maxY) {
            addFooter();
            doc.addPage();
            pageNum++;
            y = 20;
        }
    };

    // --- HEADER ---
    doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, marginL, 18);
    if (subtitle) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, marginL, 26);
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('AERA Hausverwaltung', pageW - marginR, 14, { align: 'right' });
    doc.text(new Date().toLocaleDateString('de-DE'), pageW - marginR, 20, { align: 'right' });

    y = 46;

    // --- PARSE TEXT LINE BY LINE ---
    const lines = text.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines — add small spacing
        if (!trimmed) {
            y += 3;
            continue;
        }

        // H1 — # Header
        if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
            checkPage(12);
            doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const headerText = trimmed.replace(/^# /, '').replace(/\*\*/g, '');
            doc.text(headerText, marginL, y);
            y += 4;
            doc.setDrawColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.setLineWidth(0.4);
            doc.line(marginL, y, marginL + contentW, y);
            y += 6;
            continue;
        }

        // H2 — ## Header
        if (trimmed.startsWith('## ')) {
            checkPage(10);
            y += 2;
            doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            const headerText = trimmed.replace(/^## /, '').replace(/\*\*/g, '');
            doc.text(headerText, marginL, y);
            y += 2;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.line(marginL, y, marginL + contentW, y);
            y += 5;
            continue;
        }

        // H3 — ### Header
        if (trimmed.startsWith('### ')) {
            checkPage(8);
            y += 1;
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const headerText = trimmed.replace(/^### /, '').replace(/\*\*/g, '');
            doc.text(headerText, marginL, y);
            y += 6;
            continue;
        }

        // Horizontal rule
        if (trimmed === '---' || trimmed === '***') {
            checkPage(6);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(marginL, y + 2, marginL + contentW, y + 2);
            y += 6;
            continue;
        }

        // List item (- or *)
        const isListItem = /^[-*•]\s/.test(trimmed);
        const listIndent = isListItem ? 6 : 0;

        // Clean text: strip markdown bold markers for rendering
        let cleanText = trimmed;
        if (isListItem) cleanText = cleanText.replace(/^[-*•]\s/, '');

        // Check if line starts bold
        const isBold = cleanText.startsWith('**') && cleanText.includes('**', 2);

        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);

        if (isBold) {
            // Render bold prefix and normal suffix
            const boldEnd = cleanText.indexOf('**', 2);
            const boldPart = cleanText.substring(2, boldEnd);
            const rest = cleanText.substring(boldEnd + 2).replace(/^\s*:?\s*/, ': ').replace(/\*\*/g, '');

            checkPage(5);
            if (isListItem) {
                doc.setFont('helvetica', 'normal');
                doc.text('•', marginL, y);
            }

            doc.setFont('helvetica', 'bold');
            doc.text(boldPart, marginL + listIndent, y);
            const boldWidth = doc.getTextWidth(boldPart);

            if (rest && rest.trim() !== ':') {
                doc.setFont('helvetica', 'normal');
                // Wrap the rest if it would overflow
                const restLines = doc.splitTextToSize(rest, contentW - listIndent - boldWidth);
                if (restLines.length === 1) {
                    doc.text(rest, marginL + listIndent + boldWidth, y);
                    y += 5;
                } else {
                    doc.text(restLines[0], marginL + listIndent + boldWidth, y);
                    y += 5;
                    for (let i = 1; i < restLines.length; i++) {
                        checkPage(5);
                        doc.text(restLines[i], marginL + listIndent, y);
                        y += 4.5;
                    }
                }
            } else {
                y += 5;
            }
        } else {
            // Normal text — strip remaining markdown
            cleanText = cleanText.replace(/\*\*/g, '');

            checkPage(5);
            if (isListItem) {
                doc.setFont('helvetica', 'normal');
                doc.text('•', marginL, y);
            }

            doc.setFont('helvetica', 'normal');
            const wrapped = doc.splitTextToSize(cleanText, contentW - listIndent);
            for (const wLine of wrapped) {
                checkPage(5);
                doc.text(wLine, marginL + listIndent, y);
                y += 4.5;
            }
        }
    }

    addFooter();
    return doc;
}

/** Generate and download a PDF from text */
export function downloadTextAsPdf(
    text: string,
    filename: string,
    options?: Parameters<typeof textToPdf>[1]
): void {
    const doc = textToPdf(text, options);
    doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Generate a Blob URL for PDF preview in an iframe */
export function previewTextAsPdf(
    text: string,
    options?: Parameters<typeof textToPdf>[1]
): string {
    const doc = textToPdf(text, options);
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
}
