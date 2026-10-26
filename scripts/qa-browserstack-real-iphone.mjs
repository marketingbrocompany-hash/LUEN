// Real PHYSICAL iPhone Safari read-only QA. No uploads, form submissions or photo screenshots.
// Requires BrowserStack Automate Mobile, separate from a BrowserStack Live trial.
import assert from "node:assert/strict";
import webdriver from "selenium-webdriver";

const { Builder, By } = webdriver;
const userName = process.env.BROWSERSTACK_USERNAME;
const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
const deviceName = process.env.BROWSERSTACK_DEVICE || "iPhone 16";
const osVersion = process.env.BROWSERSTACK_OS_VERSION || "18";
const results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
if (!userName || !accessKey) {
  console.error("Missing BrowserStack Automate credentials: BROWSERSTACK_USERNAME/BROWSERSTACK_ACCESS_KEY.");
  process.exit(2);
}
const caps = {
  browserName: "Safari",
  "bstack:options": {
    userName, accessKey, deviceName, osVersion, realMobile: "true",
    projectName: "LUEN Homepage", buildName: "LUEN production real iPhone QA",
    sessionName: "Safari homepage animation and Herahera native swipe",
    video: false, debug: false, networkLogs: false
  }
};
let driver;
async function waitFor(check, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const result = await check(); if (result) return result; }
    catch { /* retry only until timeout */ }
    await delay(600);
  }
  throw new Error(label + " did not become ready");
}
const passed = (name, result) => results.push({ name, status: "PASS", ...result });
try {
  driver = await new Builder().usingServer("https://hub-cloud.browserstack.com/wd/hub")
    .withCapabilities(caps).build();
  await driver.manage().setTimeouts({ pageLoad: 45000, script: 25000, implicit: 0 });
  await driver.get("https://luenkorea.com/");
  const home = await waitFor(() => driver.executeScript(function () {
    const rails = document.querySelectorAll("#selected-content .portfolio-viewport");
    if (document.readyState === "loading" || rails.length !== 2) return null;
    return {
      viewport: innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rails: rails.length, cards: document.querySelectorAll("#selected-content .loop-set:not(.ios-loop-clone) .portfolio-card").length
    };
  }), "Production homepage rails");
  assert.ok(home.viewport >= 300 && home.viewport <= 700, "Viewport not a mobile iPhone");
  assert.ok(home.overflow <= 3, "Homepage horizontal overflow detected");
  assert.equal(home.rails, 2);
  assert.equal(home.cards, 12);
  passed("iPhone homepage responsive layout", home);

  await driver.findElement(By.id("hamburger")).click();
  assert.equal(await driver.executeScript(function () {
    return document.querySelector("#hamburger").getAttribute("aria-expanded");
  }), "true", "Mobile menu did not open");
  await driver.findElement(By.id("mobileClose")).click();
  assert.equal(await driver.executeScript(function () {
    return document.querySelector("#hamburger").getAttribute("aria-expanded");
  }), "false", "Mobile menu did not close");
  passed("Real iPhone menu taps", { open: true, close: true });

  await driver.executeScript(function () {
    document.querySelector("#selected-content").scrollIntoView({ block: "center" });
  });
  const sample = () => driver.executeScript(function () {
    return [...document.querySelectorAll("#selected-content .portfolio-viewport")].map(el => ({
      cloneCount: el.querySelectorAll(".ios-loop-clone").length,
      transform: getComputedStyle(el.querySelector(".loop-track")).transform
    }));
  });
  await waitFor(async () => (await sample()).every(v => v.cloneCount > 0), "iOS carousel clones");
  const a = await sample();
  await delay(1100);
  const b = await sample();
  await delay(1100);
  const c = await sample();
  for (let i = 0; i < 2; i++) {
    assert.ok(a[i].cloneCount > 0);
    assert.notEqual(a[i].transform, b[i].transform, "Rail " + i + " animation frozen");
    assert.notEqual(b[i].transform, c[i].transform, "Rail " + i + " animation stopped");
  }
  passed("YouTube and Instagram Reels live motion", { rails: 2, samples: 3 });

  await driver.get("https://luenkorea.com/cases/herahera-seoul-fnb/");
  const detail = await waitFor(() => driver.executeScript(function () {
    const pop = document.querySelector(".herahera-pop-feature > img");
    const photos = [...document.querySelectorAll(".herahera-visitor-gallery img")];
    if (!pop || photos.length !== 4 || !pop.complete || !pop.naturalWidth
      || !photos.every(p => p.complete && p.naturalWidth >= 550)) return null;
    return {
      popWidth: pop.naturalWidth, popHeight: pop.naturalHeight,
      photoPaths: photos.map(p => p.getAttribute("src")),
      cards: document.querySelectorAll(".herahera-video-card").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  }), "Herahera approved POP and four visitor images", 30000);
  assert.equal(detail.cards, 2);
  assert.ok(detail.popWidth > 1100 && detail.popHeight > 1300);
  assert.ok(detail.overflow <= 3);
  for (let i = 0; i < 4; i++) {
    assert.equal(detail.photoPaths[i], "/assets/images/cases/herahera-visitor-0" + (i + 1) + ".webp");
  }
  passed("Herahera real iPhone media decode", { pop: true, mosaicedPhotos: 4, videoCards: 2 });
  await driver.findElement(By.css('a[href="#case-content"]')).click();
  assert.equal(await driver.executeScript("return location.hash"), "#case-content");
  await driver.findElement(By.css('a[href="#case-offline"]')).click();
  assert.equal(await driver.executeScript("return location.hash"), "#case-offline");
  passed("Herahera anchor taps", { count: 2 });

  await driver.executeScript(function () {
    document.querySelector(".herahera-visitor-gallery").scrollIntoView({ block: "center" });
  });
  const gallery = await driver.findElement(By.css(".herahera-visitor-gallery"));
  const before = await driver.executeScript(function () {
    const e = document.querySelector(".herahera-visitor-gallery");
    return { x: e.scrollLeft, width: e.clientWidth, total: e.scrollWidth };
  });
  assert.ok(before.total > before.width + 50, "Visitor carousel is not horizontally scrollable");
  // Native Appium/iOS gesture: do not fake touch with JS scrollLeft.
  let maxScrollX = before.x;
  for (let swipe = 0; swipe < 4; swipe++) {
    await driver.executeScript("mobile: swipe", { element: await gallery.getId(), direction: "left" });
    await delay(450);
    const x = await driver.executeScript(function () {
      return document.querySelector(".herahera-visitor-gallery").scrollLeft;
    });
    maxScrollX = Math.max(maxScrollX, x);
  }
  assert.ok(maxScrollX > before.x + 25, "Native iPhone visitor swipe did not move the gallery");
  assert.ok(maxScrollX >= before.total - before.width - 30, "Four native iPhone swipes did not reach last visitor image");
  passed("Native iPhone swipe to VISIT 04", { nativeTouch: true, swipes: 4, reachedLastPhoto: true });
  console.log("LUEN_REAL_IPHONE_QA " + JSON.stringify({
    status: "PASS", device: deviceName, iOS: osVersion, results
  }));
} catch (error) {
  console.error("LUEN_REAL_IPHONE_QA " + JSON.stringify({
    status: "FAIL", device: deviceName, iOS: osVersion, results,
    error: String(error?.message || error).slice(0, 650)
  }));
  process.exitCode = 1;
} finally {
  if (driver) try { await driver.quit(); } catch {}
}
