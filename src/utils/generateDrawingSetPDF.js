/**
 * Generate a combined PDF from all documentation markdown files
 * Creates a "Drawing Set" PDF with all guides combined
 */

const DOCUMENTATION_FILES = [
  "SMART_THERMOSTAT_BUILD_GUIDE.md",
  "SHOPPING-LIST-FINAL.md",
  "DEHUMIDIFIER-WIRING-GUIDE.md",
  "CH340-RELAY-SETUP.md",
  "USB-RELAY-OPTIONS.md",
  "WINDOW-AC-TESTING.md",
  "USB-TEMPERATURE-HUMIDITY-SENSORS.md",
  "FURNACE-POWER-SETUP.md",
  "THERMOSTAT-ENCLOSURE-SPEC.md",
  "ANDROID-TABLET-THERMOSTAT.md",
  "BUILD_GUIDE_YOUR_PARTS.md",
  "relay-setup.md",
  "COST-REDUCTION.md",
  "INSTALLATION-GUIDE.md",
];

/**
 * Convert markdown to formatted text for PDF
 */
function markdownToText(markdown) {
  if (!markdown) return "";

  let text = markdown
    // Remove images (keep alt text as note)
    .replace(/!\[(.*?)\]\(.*?\)/g, "[Image: $1]")
    // Convert headers with proper spacing
    .replace(/^#### (.*$)/gim, "\n\n$1\n")
    .replace(/^### (.*$)/gim, "\n\n$1\n")
    .replace(/^## (.*$)/gim, "\n\n$1\n")
    .replace(/^# (.*$)/gim, "\n\n$1\n")
    // Convert bold (keep for emphasis)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    // Convert italic
    .replace(/\*(.*?)\*/g, "$1")
    // Convert code blocks (preserve as monospace note)
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```/g, "").trim();
      return `\n[Code Block]\n${code}\n[/Code Block]\n`;
    })
    // Convert inline code
    .replace(/`([^`]+)`/g, "$1")
    // Convert links (keep text)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Convert blockquotes
    .replace(/^> (.*$)/gim, "$1")
    // Convert horizontal rules
    .replace(/^---$/gim, "\n─────────────────────────────────\n")
    // Convert tables (simplified)
    .replace(/\|(.+)\|/g, (match) => {
      return match.replace(/\|/g, " | ").trim();
    })
    // Clean up multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/**
 * Generate PDF from all documentation files
 */
export async function generateDrawingSetPDF() {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    // Set up PDF styling
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = margin;
    const lineHeight = 7;
    const titleHeight = 12;

    // Add title page
    doc.setFontSize(24);
    doc.text("Drawing Set", pageWidth / 2, 50, { align: "center" });
    doc.setFontSize(14);
    doc.text("Complete Documentation Package", pageWidth / 2, 70, {
      align: "center",
    });
    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      85,
      { align: "center" }
    );

    // Add table of contents
    yPosition = 110;
    doc.setFontSize(16);
    doc.text("Table of Contents", margin, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    DOCUMENTATION_FILES.forEach((file, index) => {
      const name = file.replace(".md", "").replace(/-/g, " ");
      doc.text(`${index + 1}. ${name}`, margin + 5, yPosition);
      yPosition += lineHeight;

      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    });

    // Process each documentation file
    for (let i = 0; i < DOCUMENTATION_FILES.length; i++) {
      const filename = DOCUMENTATION_FILES[i];

      try {
        // Fetch markdown file
        const response = await fetch(`/docs/${filename}`);
        if (!response.ok) {
          console.warn(`Failed to load ${filename}: ${response.statusText}`);
          continue;
        }

        const markdown = await response.text();
        const text = markdownToText(markdown);

        // Add new page for each document
        doc.addPage();
        yPosition = margin;

        // Add document title
        doc.setFontSize(16);
        const docTitle = filename.replace(".md", "").replace(/-/g, " ");
        doc.text(docTitle, margin, yPosition);
        yPosition += titleHeight + 5;

        // Add horizontal line
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        // Add document content with better formatting
        doc.setFontSize(10);
        const paragraphs = text.split("\n\n");

        for (let j = 0; j < paragraphs.length; j++) {
          const paragraph = paragraphs[j].trim();
          if (!paragraph) continue;

          // Check if we need a new page
          if (yPosition > pageHeight - margin - lineHeight * 3) {
            doc.addPage();
            yPosition = margin;
          }

          // Handle special formatting
          if (paragraph.startsWith("[Image:")) {
            doc.setFontStyle("italic");
            doc.setTextColor(100, 100, 100);
            const lines = doc.splitTextToSize(paragraph, maxWidth);
            lines.forEach((line) => {
              if (yPosition > pageHeight - margin - lineHeight) {
                doc.addPage();
                yPosition = margin;
              }
              doc.text(line, margin, yPosition);
              yPosition += lineHeight;
            });
            doc.setFontStyle("normal");
            doc.setTextColor(0, 0, 0);
          } else if (paragraph.startsWith("[Code Block]")) {
            doc.setFont("courier");
            const codeText = paragraph
              .replace(/\[Code Block\]|\[\/Code Block\]/g, "")
              .trim();
            const lines = doc.splitTextToSize(codeText, maxWidth);
            lines.forEach((line) => {
              if (yPosition > pageHeight - margin - lineHeight) {
                doc.addPage();
                yPosition = margin;
              }
              doc.text(line, margin + 5, yPosition);
              yPosition += lineHeight;
            });
            doc.setFont("helvetica");
          } else {
            // Regular paragraph
            const lines = doc.splitTextToSize(paragraph, maxWidth);
            lines.forEach((line) => {
              if (yPosition > pageHeight - margin - lineHeight) {
                doc.addPage();
                yPosition = margin;
              }
              doc.text(line, margin, yPosition);
              yPosition += lineHeight;
            });
          }

          // Add spacing between paragraphs
          yPosition += 3;
        }

        // Add page break after each document
        yPosition += 10;
      } catch (error) {
        console.error(`Error processing ${filename}:`, error);
        // Continue with next file
      }
    }

    // Save the PDF
    doc.save("drawing-set.pdf");

    return { success: true };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return { success: false, error: error.message };
  }
}
