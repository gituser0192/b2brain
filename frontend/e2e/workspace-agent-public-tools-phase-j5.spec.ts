import { expect, test } from "@playwright/test";
import { installSyntheticApi } from "./fixtures/synthetic-workspace";

test("renders local calculations and truthful public-provider availability", async ({ page }) => {
  await installSyntheticApi(page);
  let calls = 0;
  await page.route("**/api/v1/workspace-agent/messages", async (route) => {
    calls += 1;
    const message = (route.request().postDataJSON() as { message: string }).message;
    const publicResult = message.includes("weather")
      ? { toolName: "public.weather", availability: "UNAVAILABLE", provenance: "EXTERNAL_SOURCE", answer: "This public-information provider is not configured. No external request was made.", external: true }
      : { toolName: "public.calculate", availability: "VERIFIED", provenance: "CALCULATION", answer: "5000 + (5000 × 18 ÷ 100) = 5,900.", external: false, details: { result: 5900 } };
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, data: { answer: publicResult.answer, publicResult } }) });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open Ask B² Brain" }).click();
  const drawer = page.getByRole("dialog", { name: "Ask B² Brain" });
  await drawer.getByLabel("Message Ask B² Brain").fill("Calculate 18% GST on 5000");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByRole("region", { name: "Public information" }).getByText("Local calculation")).toBeVisible();
  await drawer.getByLabel("Message Ask B² Brain").fill("weather in Gurugram");
  await drawer.getByRole("button", { name: "Send" }).click();
  await expect(drawer.getByText("Based on public information—not your B² Brain records.")).toBeVisible();
  expect(calls).toBe(2);
});
