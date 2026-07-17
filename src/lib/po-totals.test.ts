import { describe, it, expect } from "vitest";
import { computePoTotals } from "./po-totals";

describe("computePoTotals", () => {
  const baseLines = [{ unitPrice: 100, quantity: 2 }, { unitPrice: 50, quantity: 1 }];

  it("sums subtotal from line unitPrice * quantity", () => {
    const result = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: false,
      miscAmount: null,
    });
    expect(result.subtotal).toBe(250);
  });

  it("applies 14% VAT only when vatRegistered", () => {
    const registered = computePoTotals({
      lines: baseLines,
      vatRegistered: true,
      advancePaymentRegistered: true,
      eInvoiced: false,
      miscAmount: null,
    });
    expect(registered.vatAmount).toBeCloseTo(35, 5);

    const unregistered = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: false,
      miscAmount: null,
    });
    expect(unregistered.vatAmount).toBe(0);
  });

  it("applies WHT with inverse logic: only when NOT advance-payment-registered", () => {
    const notRegistered = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: false,
      eInvoiced: false,
      miscAmount: null,
    });
    expect(notRegistered.whtAmount).toBeCloseTo(2.5, 5);

    const registered = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: false,
      miscAmount: null,
    });
    expect(registered.whtAmount).toBe(0);
  });

  it("applies 14% VAT to misc amount only when eInvoiced", () => {
    const invoiced = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: true,
      miscAmount: 100,
    });
    expect(invoiced.miscWithVat).toBeCloseTo(114, 5);

    const notInvoiced = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: false,
      miscAmount: 100,
    });
    expect(notInvoiced.miscWithVat).toBe(100);
  });

  it("treats null miscAmount as zero", () => {
    const result = computePoTotals({
      lines: baseLines,
      vatRegistered: false,
      advancePaymentRegistered: true,
      eInvoiced: true,
      miscAmount: null,
    });
    expect(result.miscWithVat).toBe(0);
  });

  it("computes totalAmount as subtotal + vat + miscWithVat - wht", () => {
    const result = computePoTotals({
      lines: baseLines, // subtotal 250
      vatRegistered: true, // +35
      advancePaymentRegistered: false, // -2.5 WHT
      eInvoiced: true,
      miscAmount: 10, // *1.14 = 11.4
    });
    expect(result.totalAmount).toBeCloseTo(250 + 35 + 11.4 - 2.5, 5);
  });

  it("returns zero totals for no line items", () => {
    const result = computePoTotals({
      lines: [],
      vatRegistered: true,
      advancePaymentRegistered: false,
      eInvoiced: true,
      miscAmount: null,
    });
    expect(result.subtotal).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});
