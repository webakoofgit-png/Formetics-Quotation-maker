import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
mkdirSync("artifacts", { recursive: true });
const chromePath =
  process.env["CHROME_PATH"] ||
  (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : undefined);
const browser = await chromium.launch({
  ...(chromePath ? { executablePath: chromePath } : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const backendRequests=[];
page.on('request',request=>{if(new URL(request.url()).hostname.endsWith('.supabase.co'))backendRequests.push(request.url());});
page.on("pageerror", (error) => errors.push(error.message));
try {
  const response = await page.goto("http://127.0.0.1:8080/");
  assert.equal(response.status(), 200);
  await page.locator('.app[data-ready="true"]').waitFor({ timeout: 60000 });
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "The bigger picture." }).count(), 0);
  await page.screenshot({ path: "artifacts/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/login-mobile.png", fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("Formatix@123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "The bigger picture." }).waitFor();
  await page.screenshot({ path: "artifacts/dashboard-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Create Quotation" }).click();
  await page.getByLabel("Customer name *", { exact: true }).fill("Browser Test Customer");
  await page.getByLabel("Mobile number *", { exact: true }).fill("9876543210");
  await page.getByLabel("Vehicle model *", { exact: true }).fill("Hyundai Creta");
  await page.getByLabel("Colour", { exact: true }).fill("Pearl White");
  await page.getByRole("button", { name: /Ceramic coating/ }).click();
  await page.getByLabel("Discount (₹)", { exact: true }).fill("600");
  await page.getByLabel("Booking amount recorded (₹)", { exact: true }).fill("5000");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("link", { name: "New Quotation", exact: true }).click();
  assert.equal(
    await page.getByLabel("Customer name *", { exact: true }).inputValue(),
    "Browser Test Customer",
  );
  await page.screenshot({ path: "artifacts/builder-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Preview PDF", exact: true }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "Preview quotation PDF" }).waitFor();
  assert.ok(
    (await page.getByTitle("Quotation PDF preview").getAttribute("src")).startsWith("blob:"),
  );
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Save Quotation", exact: true }).click();
  await page.getByRole("heading", { name: "All Quotations", exact: true }).waitFor();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("formatix-demo-v1")));
  assert.equal(state.quotes.length, 1);
  assert.equal(state.quotes[0].discount, 60000);
  await page.getByLabel(/^Status for FMT-/).selectOption("Booked");
  await page.getByRole("button", { name: "Schedule follow-up", exact: true }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Discuss booking date");
  await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
  await page.getByRole("link", { name: /Follow-ups/ }).click();
  await page.getByRole("heading", { name: "Browser Test Customer", exact: true }).waitFor();
  await page.getByRole("button", { name: "Calendar view", exact: true }).click();
  assert.equal(await page.locator(".calendar-grid button").count(), 1);
  await page.getByRole("link", { name: "All Quotations", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download quotation", exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith(".pdf"));
  await download.saveAs("artifacts/quotation-example.pdf");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.screenshot({ path: "artifacts/dashboard-with-record.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "New Quotation", exact: true }).click();
  await page.getByLabel("Customer name *", { exact: true }).waitFor();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: "artifacts/builder-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.screenshot({ path: "artifacts/dashboard-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(backendRequests,[],'Client demo must not contact Supabase');
  console.log(
    "PASS: desktop/mobile quotation creation, persistence, booking status, follow-up calendar, PDF download, drawer focus, no horizontal overflow or page errors.",
  );
} finally {
  await browser.close();
}
