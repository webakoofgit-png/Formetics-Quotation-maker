import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuoteManager from "@/features/quote-manager/QuoteManager";
vi.mock("@/features/quote-manager/backend", () => ({
  auth: () => ({ getSession: async () => ({ data: { session: null } }) }),
  loadCloud: vi.fn(),
  saveCloud: vi.fn(),
  createWorkspace: vi.fn(),
  setMember: vi.fn(),
  sharePdf: vi.fn(),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
}));
beforeEach(() => {
  localStorage.clear();
  location.hash = "";
});
afterEach(() => cleanup());
describe("Studio quotation workflow", () => {
  it("preserves an unsaved form across navigation, saves a real quote, updates status and groups customer history", async () => {
    render(<QuoteManager />);
    fireEvent.click(screen.getByRole("button", { name: "Create Quotation" }));
    fireEvent.change(screen.getByLabelText("Customer name *"), {
      target: { value: "Test Customer" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number *"), {
      target: { value: "+91 9876543210" },
    });
    fireEvent.change(screen.getByLabelText("Vehicle model *"), { target: { value: "Test SUV" } });
    fireEvent.click(screen.getByRole("button", { name: /Paint protection film/ }));
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    fireEvent.click(screen.getByRole("link", { name: "New Quotation" }));
    expect(screen.getByLabelText("Customer name *")).toHaveValue("Test Customer");
    fireEvent.click(screen.getByRole("button", { name: "Save Quotation" }));
    await screen.findByRole("heading", { name: "All Quotations", level: 1 });
    const state = JSON.parse(localStorage.getItem("formatix-demo-v1") || "{}");
    expect(state.quotes).toHaveLength(1);
    expect(state.quotes[0].status).toBe("Sent");
    expect(state.quotes[0].phone).toBe("9876543210");
    fireEvent.change(screen.getByLabelText(/^Status for FMT-/), { target: { value: "Booked" } });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("formatix-demo-v1") || "{}").quotes[0].status).toBe(
        "Booked",
      ),
    );
    fireEvent.click(screen.getByRole("link", { name: "Customers" }));
    expect(screen.getByRole("button", { name: /Test Customer/ })).toBeInTheDocument();
    cleanup();
    render(<QuoteManager />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Test Customer/ })).toBeInTheDocument(),
    );
  }, 15000);
});
