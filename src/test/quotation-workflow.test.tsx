import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QuoteManager from "@/features/quote-manager/QuoteManager";
import { loadCloud } from "@/features/quote-manager/backend";
import { initialStore } from "@/features/quote-manager/model";
const sessionApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock("@/features/quote-manager/backend", () => ({
  auth: () => sessionApi,
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
  sessionApi.getSession.mockResolvedValue({ data: { session: null } });
  sessionApi.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  sessionApi.signInWithPassword.mockReset();
  vi.mocked(loadCloud).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe("Studio quotation workflow", () => {
  it("preserves an unsaved form across navigation, saves a real quote, updates status and groups customer history", async () => {
    render(<QuoteManager />);
    fireEvent.click(await screen.findByRole("button", { name: "Explore local demo" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Explore local demo" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Test Customer/ })).toBeInTheDocument(),
    );
  }, 15000);
  it("shows login before any dashboard content, including direct page links", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ENABLE_DEMO", "false");
    location.hash = "#All%20Quotations";
    render(<QuoteManager />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "All Quotations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Quotation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explore local demo" })).not.toBeInTheDocument();
  });
  it("keeps invalid credentials on the login screen with an inline error", async () => {
    sessionApi.signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    render(<QuoteManager />);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(screen.queryByRole("heading", { name: "The bigger picture." })).not.toBeInTheDocument();
  });
  it("opens the workspace only after successful authentication and membership loading", async () => {
    sessionApi.signInWithPassword.mockResolvedValue({ error: null, data: { session: {} } });
    vi.mocked(loadCloud).mockResolvedValue({
      state: initialStore(),
      revision: 1,
      workspace: "test-studio",
      members: [],
      role: "Staff",
    });
    render(<QuoteManager />);
    await screen.findByRole("button", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "The bigger picture." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome back." })).not.toBeInTheDocument();
  });
});
