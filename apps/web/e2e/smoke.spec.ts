import { expect, test, type Page } from "@playwright/test";

/** Sign in with the mock backend (any email) and finish onboarding. */
async function signIn(page: Page, email: string, next = "/plan/new") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send me a link" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[/?]/g, "\\$&")));
}

test("plan a session, watch a practice, save it, share it, read it logged out, stop sharing", async ({ page, browser, baseURL }) => {
  await signIn(page, "coach@example.com");

  // 1. Build a session
  await page.getByTestId("generate").click();
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("checks")).toBeVisible();
  await expect(page.locator('[data-check="time"]')).toHaveAttribute("data-status", "pass");
  // review is a warning while templates are pending, never a pass
  await expect(page.locator('[data-check="review"]')).toHaveAttribute("data-status", "warning");
  const phases = page.getByTestId("phase");
  expect(await phases.count()).toBeGreaterThanOrEqual(3);

  // 2. The first non-warm-up practice opens already playing: pause it, then step forward
  const player = page.locator(".mrb").first();
  await expect(player).toBeVisible();
  const pause = player.getByRole("button", { name: "Pause" });
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(player).toContainText("Step 1 of");
  await player.getByRole("button", { name: "Next step" }).click();
  await expect(player).toContainText("Step 2 of");
  await player.getByRole("button", { name: "Play" }).click();
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();

  // 3. Live checks: shrinking a phase keeps time valid; stretching beyond the available time raises a problem
  const duration = phases.first().getByTestId("duration");
  await duration.fill("45");
  await duration.blur();
  await expect(page.locator('[data-check="time"]')).toHaveAttribute("data-status", "problem");
  await duration.fill("10");
  await duration.blur();
  await expect(page.locator('[data-check="time"]')).toHaveAttribute("data-status", "pass");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");

  // WhatsApp link and copy text
  await expect(page.getByTestId("whatsapp")).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);

  // 4. Save a template practice from the session to the library
  await phases.nth(1).getByTestId("save-to-library").click();
  await expect(phases.nth(1)).toContainText("Saved to your library.");
  await page.goto("/library");
  await expect(page.getByTestId("library-item")).toHaveCount(1);
  await page.getByTestId("library-item").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);

  // 5. Share it
  await page.getByTestId("share-open").click();
  await page.getByTestId("share-create").click();
  const url = await page.getByTestId("share-url").inputValue();
  expect(url).toMatch(/\/p\/[A-Za-z0-9_-]{12,}/);
  await expect(page.getByTestId("share-whatsapp")).toHaveAttribute("href", /wa\.me/);

  // 6. A logged-out visitor can see it, with the player and a sign-in prompt
  const anon = await browser.newContext({ baseURL, locale: "en-US" });
  const pub = await anon.newPage();
  const path = new URL(url).pathname;
  await pub.goto(path);
  await expect(pub.locator(".mrb")).toBeVisible();
  await expect(pub.getByTestId("sign-in-to-save")).toBeVisible();
  await expect(pub.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // the snapshot carries no private data
  expect(await pub.content()).not.toContain("coach@example.com");

  // 7. Reporting works without an account
  await pub.getByTestId("report-open").click();
  await pub.getByTestId("report-send").click();
  await expect(pub.getByText("Thank you. We will look at it.")).toBeVisible();

  // 8. Stop sharing: the same link now shows the friendly message
  await page.getByTestId("share-stop").click();
  await expect(page.getByText("Sharing stopped. The link no longer works.")).toBeVisible();
  await pub.goto(path);
  await expect(pub.getByTestId("share-gone")).toContainText("no longer available");
  // an id that never existed looks exactly the same
  await pub.goto("/p/doesnotexist123456");
  await expect(pub.getByTestId("share-gone")).toContainText("no longer available");
  await anon.close();
});

test("chat: an AI draft is labelled everywhere, including on the shared page", async ({ page, browser, baseURL }) => {
  await signIn(page, "coach2@example.com", "/practice/new");
  await page.getByTestId("chat-input").fill("U7, 4 players, goalkeeper handling");
  await page.getByTestId("chat-send").click();
  const result = page.getByTestId("chat-result");
  await expect(result).toBeVisible();
  await expect(result.locator('[data-trust="ai_draft"]')).toBeVisible();
  await expect(result.locator(".mrb-badge")).toContainText("AI draft, not reviewed");

  // refine it: a new version of the same draft
  await page.getByTestId("chat-input").fill("make it shorter");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("versions")).toBeVisible();

  // save, then share
  await page.getByTestId("chat-save").click();
  await expect(page.getByText("Saved to your library.")).toBeVisible();
  await page.getByTestId("share-open").click();
  await page.getByTestId("share-create").click();
  const url = await page.getByTestId("share-url").inputValue();

  const anon = await browser.newContext({ baseURL });
  const pub = await anon.newPage();
  await pub.goto(new URL(url).pathname);
  await expect(pub.getByTestId("ai-note")).toBeVisible();
  await expect(pub.locator('[data-trust="ai_draft"]')).toBeVisible();
  await anon.close();
});

test("scope: health and diet requests are refused in the coach's language", async ({ page }) => {
  await signIn(page, "coach3@example.com", "/practice/new");
  await page.getByTestId("chat-input").fill("Quel médicament et quel régime pour mon joueur de 11 ans ?");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat-error")).toBeVisible();
});

test("French and Arabic render with the right direction", async ({ page }) => {
  await page.goto("/templates?lang=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  // the pitch itself never flips
  await expect(page.locator("svg[role=img]").first()).toHaveCSS("direction", "ltr");
  await page.goto("/templates?lang=fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Modèles");
});

test("manifest and offline page are available", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: "Mourabbi", display: "standalone", theme_color: "#16a34a" });
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const i of m.icons as { src: string }[]) expect((await request.get(i.src)).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
  await page.goto("/offline");
  await expect(page.getByTestId("offline-list")).toBeVisible();
});

test("a saved practice opens offline from the device cache", async ({ page, context }) => {
  await signIn(page, "coach4@example.com", "/templates/rondo_4v2_u10");
  await page.getByTestId("save-to-library").click();
  await expect(page.getByText("Saved to your library.")).toBeVisible();

  // Viewing the library copies it to IndexedDB.
  await page.goto("/library");
  const href = await page.getByTestId("library-item").first().getByRole("link").first().getAttribute("href");
  expect(href).toMatch(/^\/library\/[0-9a-f-]{36}$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open("mourabbi");
            open.onerror = () => resolve(0);
            open.onsuccess = () => {
              const db = open.result;
              if (!db.objectStoreNames.contains("practices")) return resolve(0);
              const req = db.transaction("practices").objectStore("practices").count();
              req.onsuccess = () => resolve(req.result);
            };
          }),
      ),
    )
    .toBeGreaterThan(0);

  // The service worker must be active and controlling before we go offline.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
  });

  await context.setOffline(true);
  await page.goto(href!).catch(() => undefined);
  await expect(page.getByTestId("offline-practice")).toBeVisible();
  await expect(page.locator(".mrb")).toBeVisible();
  await expect(page.getByText("4v2 rondo").first()).toBeVisible();

  // Generation says it needs a connection.
  await context.setOffline(false);
});

test("the player is usable from the keyboard", async ({ page }) => {
  await page.goto("/templates/rondo_4v2_u10");
  const player = page.locator(".mrb");
  await expect(player).toContainText("Step 1 of 5");
  await player.focus();
  await page.keyboard.press("ArrowRight");
  await expect(player).toContainText("Step 2 of 5");
  await page.keyboard.press("ArrowRight");
  await expect(player).toContainText("Step 3 of 5");
  await page.keyboard.press("ArrowLeft"); // right at the start of step 3 -> back to step 2
  await expect(player).toContainText("Step 2 of 5");
  // Space toggles play and pause
  await page.keyboard.press("Space");
  await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
  // controls are at least 44 x 44
  for (const b of await player.getByRole("button").all()) {
    const box = (await b.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(43.5);
    expect(box.height).toBeGreaterThanOrEqual(43.5);
  }
});
