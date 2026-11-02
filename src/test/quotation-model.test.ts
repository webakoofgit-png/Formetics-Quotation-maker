import { describe, expect, it } from "vitest";
import {
  blankQuote,
  initialStore,
  normalizePhone,
  rupees,
  totals,
  validateQuote,
} from "@/features/quote-manager/model";
import { makePdf } from "@/features/quote-manager/pdf";

describe("Quotation financial invariants", () => {
  it("extracts GST after discount, without adding tax a second time", () => {
    expect(totals([{ id: "1", name: "Protection", price: 1180000 }], 118000, 200000)).toEqual({
      subtotal: 1180000,
      discount: 118000,
      total: 1062000,
      taxable: 900000,
      gst: 162000,
      booking: 200000,
      balance: 862000,
    });
  });
  it("reconciles rounding to the paise", () => {
    const t = totals([{ id: "1", name: "Detail", price: 123457 }], 13, 7);
    expect(t.taxable + t.gst).toBe(t.total);
    expect(t.balance + t.booking).toBe(t.total);
  });
  it.each([-1, 1180001])("rejects invalid discount %s", (discount) => {
    expect(() => totals([{ id: "1", name: "Detail", price: 1180000 }], discount, 0)).toThrow(
      "Discount",
    );
  });
  it("rejects excess advances, negative prices and non-finite input", () => {
    expect(() => totals([{ id: "1", name: "Detail", price: 100 }], 0, 101)).toThrow("Booking");
    expect(() => totals([{ id: "1", name: "Detail", price: -1 }], 0, 0)).toThrow();
    expect(() => totals([], NaN, 0)).toThrow();
  });
  it("normalizes Indian phone numbers for duplicate detection", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(rupees("1999.99")).toBe(199999);
  });
  it("requires customer, phone, model and service for a finished quote", () => {
    const q = { ...blankQuote(), customer: "A Customer", phone: "9876543210" };
    expect(() => validateQuote(q, true)).not.toThrow();
    expect(() => validateQuote(q)).toThrow("vehicle");
  });
  it("has no invented customer records or metrics in demo state", () => {
    expect(initialStore().quotes).toHaveLength(0);
    expect(initialStore().services.every((s) => s.demo)).toBe(true);
  });
  it("generates a real PDF with page breaks for long quotations", async () => {
    const q = {
      ...blankQuote(),
      customer: "A Customer",
      phone: "9876543210",
      model: "Test SUV",
      number: "FMT-TEST",
      items: Array.from({ length: 90 }, (_, i) => ({
        id: String(i),
        name: `Service ${i + 1}`,
        price: 11800,
      })),
    };
    const doc = await makePdf(q, initialStore().settings);
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(doc.output().startsWith("%PDF-")).toBe(true);
    expect(doc.output()).toContain("/Subtype /Image");
  }, 15000);
});
