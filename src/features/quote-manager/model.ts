export type Status = "Draft" | "Sent" | "Booked" | "Lost";
export const categories = ["Hatchback", "Sedan", "Compact SUV", "SUV", "Luxury", "Bike"];
export type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  prices: Record<string, number>;
  active: boolean;
  demo?: boolean;
  applicableCategories?: string[];
};
export type Item = { id: string; serviceId?: string; name: string; price: number };
export type Quote = {
  id: string;
  number: string;
  date: string;
  customer: string;
  phone: string;
  source: string;
  type: string;
  category: string;
  model: string;
  colour: string;
  registration: string;
  items: Item[];
  discount: number;
  booking: number;
  status: Status;
  staff: string;
  notes: string;
};
export type Followup = {
  id: string;
  quoteId: string;
  date: string;
  employee: string;
  priority: string;
  notes: string;
  done: boolean;
};
export type Settings = {
  company: string;
  address: string;
  phone: string;
  gstin: string;
  bank: string;
  prefix: string;
  validity: number;
  terms: string;
  logo: string;
};
export type Member = { id: string; name: string; role: "Admin" | "Staff"; email: string };
export type Store = {
  quotes: Quote[];
  services: Service[];
  followups: Followup[];
  settings: Settings;
  customerNotes: Record<string, string>;
};
export const defaults: Settings = {
  company: "FORMATIX",
  address: "",
  phone: "",
  gstin: "",
  bank: "",
  prefix: "FMT",
  validity: 15,
  terms:
    "Quotation valid for the period stated above. Final scope and delivery date will be confirmed at booking.",
  logo: "",
};
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
export const rupees = (value: string | number) => Math.round(Number(value) * 100);
export function totals(items: Item[], discount: number, booking: number) {
  if (
    items.some((i) => !Number.isSafeInteger(i.price) || i.price < 0) ||
    !Number.isSafeInteger(discount) ||
    !Number.isSafeInteger(booking)
  )
    throw new Error("Enter valid monetary amounts.");
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 1000000000000)
    throw new Error("Quotation value exceeds the supported limit.");
  if (discount < 0 || discount > subtotal)
    throw new Error("Discount must be between zero and the service total.");
  const total = subtotal - discount;
  if (booking < 0 || booking > total) throw new Error("Booking amount cannot exceed the total.");
  const taxable = Math.round((total * 100) / 118);
  return {
    subtotal,
    discount,
    total,
    taxable,
    gst: total - taxable,
    booking,
    balance: total - booking,
  };
}
export function blankQuote(): Quote {
  return {
    id: uid(),
    number: "",
    date: today(),
    customer: "",
    phone: "",
    source: "Walk-in",
    type: "Car",
    category: "Sedan",
    model: "",
    colour: "",
    registration: "",
    items: [],
    discount: 0,
    booking: 0,
    status: "Draft",
    staff: "",
    notes: "",
  };
}
export const normalizePhone = (phone: string) =>
  phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
export function validateQuote(q: Quote, draft = false) {
  totals(q.items, q.discount, q.booking);
  if (!q.customer.trim()) throw new Error("Customer name is required.");
  if (!/^\d{10}$/.test(normalizePhone(q.phone)))
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  if (!draft && (!q.model.trim() || !q.items.length))
    throw new Error("Add the vehicle model and at least one service.");
  if (q.items.some((i) => !i.name.trim())) throw new Error("Every line item needs a name.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(q.date) ||
    !Number.isFinite(new Date(`${q.date}T12:00:00`).getTime())
  )
    throw new Error("Enter a valid quotation date.");
}
export function initialStore(): Store {
  return {
    quotes: [],
    services: [
      ["Paint protection film", "PPF", "Self-healing protection for your paintwork", 55000],
      [
        "Ceramic coating",
        "Ceramic & Graphene",
        "Deep gloss and hydrophobic paint protection",
        18000,
      ],
      [
        "Graphene coating",
        "Ceramic & Graphene",
        "Advanced surface protection and lasting shine",
        24000,
      ],
      ["Interior detailing", "Detailing", "A complete refresh for your cabin", 4500],
      ["Exterior detailing", "Detailing", "Cleanse, correct and refine your finish", 6000],
      ["Glass protection", "Add-ons", "Water-repellent treatment for clearer visibility", 2500],
    ].map(([name, category, description, price], n) => ({
      id: `demo-${n}`,
      name: String(name),
      category: String(category),
      description: String(description),
      prices: Object.fromEntries(
        categories.map((c, i) => [
          c,
          Math.round(Number(price) * 100 * (i === 5 ? 0.5 : 1 + i * 0.2)),
        ]),
      ),
      active: true,
      demo: true,
    })),
    followups: [],
    settings: defaults,
    customerNotes: {},
  };
}
export function csvDownload(name: string, rows: (string | number)[][]) {
  const text = rows
    .map((row) =>
      row
        .map(
          (v) =>
            `"${String(v)
              .replace(/"/g, '""')
              .replace(/^[=+@\-]/, "'$&")}"`,
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
