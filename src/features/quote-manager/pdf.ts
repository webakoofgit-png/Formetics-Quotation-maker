import type { Quote, Settings } from "./model";
import { totals } from "./model";
import { FORMATIX_LOGO, LOGO_PANEL, pdfLogo } from "./brand";

export async function makePdf(q: Quote, s: Settings) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const t = totals(q.items, q.discount, q.booking);
  const amount = (p: number) =>
    "INR " +
    (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let y = 20;
  const text = (value: string, x: number, size = 10, color = "#333333", bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    pdf.text(value, x, y);
  };
  const page = (height: number) => {
    if (y + height > 273) {
      pdf.addPage();
      y = 22;
    }
  };
  const wrap = (value: string, width = 170, x = 20, size = 9) => {
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value, width);
    for (const line of lines) {
      page(6);
      text(line, x, size);
      y += 5;
    }
  };
  pdf.setFillColor("#151515");
  pdf.rect(0, 0, 210, 45, "F");
  try {
    const prepared =
      !s.logo || s.logo === FORMATIX_LOGO ? await pdfLogo() : { data: s.logo, panel: true };
    const logo = prepared.data;
    if (!prepared.panel) {
      const width = 96,
        height = (width * LOGO_PANEL.height) / LOGO_PANEL.width,
        x = 16,
        top = 4;
      pdf.saveGraphicsState();
      pdf.rect(x, top, width, height);
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(
        logo,
        "PNG",
        x - (LOGO_PANEL.x / LOGO_PANEL.width) * width,
        top - (LOGO_PANEL.y / LOGO_PANEL.height) * height,
        (LOGO_PANEL.sourceWidth / LOGO_PANEL.width) * width,
        (LOGO_PANEL.sourceHeight / LOGO_PANEL.height) * height,
        undefined,
        "FAST",
      );
      pdf.restoreGraphicsState();
    } else {
      const props = pdf.getImageProperties(logo),
        scale = Math.min(96 / props.width, 34 / props.height);
      pdf.addImage(
        logo,
        logo.startsWith("data:image/png") ? "PNG" : "JPEG",
        16,
        5,
        props.width * scale,
        props.height * scale,
      );
    }
  } catch {
    text(s.company, 20, 23, "#D9A441", true);
  }
  y = 20;
  text("QUOTATION", 152, 12, "#FAFAFA", true);
  y = 29;
  text(q.number || "PREVIEW", 135, 8, "#dddddd");
  y = 55;
  wrap(s.address || "Studio address: configure in Settings", 105, 20, 8);
  wrap(
    [s.phone ? `Contact: ${s.phone}` : "", s.gstin ? `GSTIN: ${s.gstin}` : ""]
      .filter(Boolean)
      .join(" | "),
    170,
    20,
    8,
  );
  y += 6;
  page(35);
  text("PREPARED FOR", 20, 8, "#ad853b", true);
  text("QUOTATION DETAILS", 120, 8, "#ad853b", true);
  y += 7;
  text(q.customer, 20, 12, "#222222", true);
  text(`Date: ${q.date}`, 120, 9);
  y += 6;
  text(q.phone, 20, 9);
  const validity = new Date(`${q.date}T12:00:00`);
  validity.setDate(validity.getDate() + s.validity);
  text(`Valid until: ${validity.toLocaleDateString("en-IN")}`, 120, 9);
  y += 9;
  wrap(
    `Vehicle: ${q.model || "Not specified"} | ${q.type} / ${q.category} | ${q.colour || "Colour not specified"}`,
  );
  wrap(
    `Registration: ${q.registration || "Not supplied"} | Prepared by: ${q.staff || "Studio team"}`,
  );
  y += 5;
  const header = () => {
    pdf.setFillColor("#252525");
    pdf.rect(20, y, 170, 10, "F");
    y += 6.5;
    text("SERVICE / DESCRIPTION", 24, 8, "#FAFAFA", true);
    pdf.setFontSize(8);
    pdf.text("PRICE (GST INCLUDED)", 186, y, { align: "right" });
    y += 9;
  };
  header();
  for (const item of q.items) {
    pdf.setFontSize(10);
    const lines: string[] = pdf.splitTextToSize(item.name, 112);
    page(lines.length * 5 + 8);
    if (y === 22) header();
    const top = y;
    for (const line of lines) {
      text(line, 24, 10);
      y += 5;
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(amount(item.price), 186, top, { align: "right" });
    pdf.setDrawColor("#e7e4da");
    pdf.line(20, y + 2, 190, y + 2);
    y += 10;
  }
  page(78);
  y += 3;
  const row = (label: string, value: number, bold = false) => {
    page(10);
    text(label, 95, 9, bold ? "#222222" : "#777777", bold);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.text(amount(value), 186, y, { align: "right" });
    y += 8;
  };
  row("Services subtotal", t.subtotal);
  row("Discount", -t.discount);
  row("Taxable value", t.taxable);
  row("GST included (18%)", t.gst);
  pdf.setDrawColor("#D9A441");
  pdf.line(95, y - 3, 190, y - 3);
  row("GRAND TOTAL", t.total, true);
  row("Booking amount recorded", t.booking);
  row("Balance payable", t.balance, true);
  y += 6;
  if (q.notes) {
    page(15);
    text("NOTES", 20, 8, "#ad853b", true);
    y += 7;
    wrap(q.notes);
    y += 4;
  }
  if (s.bank) {
    page(15);
    text("PAYMENT DETAILS", 20, 8, "#ad853b", true);
    y += 7;
    wrap(s.bank);
    y += 4;
  }
  page(15);
  text("TERMS & CONDITIONS", 20, 8, "#ad853b", true);
  y += 7;
  wrap(s.terms);
  y += 5;
  wrap(
    "All prices include 18% GST. Booking amounts are recorded advances. This quotation is not a tax invoice.",
    170,
    20,
    8,
  );
  const count = pdf.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    pdf.setPage(n);
    pdf.setDrawColor("#D9A441");
    pdf.line(20, 282, 190, 282);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor("#999999");
    pdf.text(`${s.company} | ${s.phone || "Premium Detailing Studio"}`, 20, 288);
    pdf.text(`${n} / ${count}`, 190, 288, { align: "right" });
  }
  return pdf;
}
