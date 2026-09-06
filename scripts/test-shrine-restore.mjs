#!/usr/bin/env node
/**
 * UI regression: shrine-token-v1 on the main shrine opens chat (no username+key).
 * Embed without a token still demands username + key via POST /login.
 *
 * Env:
 *   API          backend origin (default http://127.0.0.1:8010)
 *   SITE         static origin (default http://127.0.0.1:8084)
 *   ADMIN_KEY    admin key (default devadminkey)
 */
import { createRequire } from "node:module";

const require = createRequire("/tmp/node_modules/puppeteer-core/package.json");
const puppeteer = require("puppeteer-core");

const API = (process.env.API || "http://127.0.0.1:8010").replace(/\/$/, "");
const SITE = (process.env.SITE || "http://127.0.0.1:8084").replace(/\/$/, "");
const ADMIN = process.env.ADMIN_KEY || "devadminkey";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function j(path, opt) {
  const r = await fetch(API + path, opt);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function seed(status) {
  const user = "ui" + Date.now().toString(36).slice(-8);
  const apply = await j("/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: user, application: "ui restore regression" }),
  });
  if (!apply.body?.token) fail("apply: " + JSON.stringify(apply.body));
  const token = apply.body.token;
  if (status === "pending") return { token, user, status: "pending" };
  const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const row = (pending.body.pending || []).find((a) => a.username === user);
  if (!row?.id) fail("pending missing " + user);
  const decide = await j("/admin/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
  });
  if (!decide.body?.ok) fail("approve: " + JSON.stringify(decide.body));
  return { token, user, status: "approved" };
}

async function openShrine(browser, page) {
  const popupP = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("shrine popup did not open")), 15000);
    const onTarget = async (target) => {
      if (target.type() !== "page") return;
      try {
        const p = await target.page();
        if (p) {
          clearTimeout(t);
          browser.off("targetcreated", onTarget);
          resolve(p);
        }
      } catch (e) { /* ignore */ }
    };
    browser.on("targetcreated", onTarget);
  });
  const opened = await page.evaluate(() => {
    if (typeof openSahurChat === "function") {
      openSahurChat();
      return "openSahurChat";
    }
    return null;
  });
  if (!opened) fail("openSahurChat is not on the landing page");
  const shrine = await popupP;
  await shrine.waitForSelector("#chooseShrine", { timeout: 15000 });
  return shrine;
}

async function viewState(shrine) {
  return shrine.evaluate(() => {
    function info(id) {
      const el = document.getElementById(id);
      if (!el) return { id, missing: true };
      const s = getComputedStyle(el);
      return {
        id,
        display: s.display,
        parent: el.parentElement ? getComputedStyle(el.parentElement).display : null,
        text: (el.innerText || "").slice(0, 240),
      };
    }
    return {
      chat: info("chat"),
      gate: info("gate"),
      applyView: info("applyView"),
      pendingView: info("pendingView"),
      loginBox: info("loginBox"),
      loginBtn: info("loginBtn"),
      name: document.getElementById("u") && document.getElementById("u").value,
      token: localStorage.getItem("shrine-token-v1"),
    };
  });
}

async function main() {
  const approved = await seed("approved");
  const pending = await seed("pending");
  console.log("seeded approved", approved.user, "pending", pending.user);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 800 });
    await page.goto(SITE + "/index.html?api=" + encodeURIComponent(API), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.evaluate((tok) => {
      localStorage.setItem("shrine-token-v1", tok);
    }, approved.token);

    const shrine = await openShrine(browser, page);
    await shrine.click("#chooseShrine");
    await shrine.waitForFunction(() => {
      const chat = document.getElementById("chat");
      const gate = document.getElementById("gate");
      const login = document.getElementById("loginBox");
      const chatOn = chat && getComputedStyle(chat).display === "flex";
      const gateOn = gate && getComputedStyle(gate).display === "flex";
      const loginOn = login && getComputedStyle(login).display !== "none" && login.offsetParent !== null;
      return chatOn && !gateOn && !loginOn;
    }, { timeout: 15000 });

    const after = await viewState(shrine);
    console.log("approved token restore", JSON.stringify(after, null, 2));
    if (after.chat.display !== "flex") fail("chat not shown for stored token");
    if (after.gate.display === "flex") fail("apply/login gate shown to returning token user");
    if (after.loginBox.display !== "none") fail("username+key box shown to returning token user");
    if (after.name !== approved.user) fail("chat username expected " + approved.user + " got " + after.name);
    if (after.token !== approved.token) fail("stored token was rotated or cleared");

    // Fresh browser profile / no token: apply + optional exported-key login, not a broken wall.
    const fresh = await browser.newPage();
    await fresh.goto(SITE + "/index.html?api=" + encodeURIComponent(API), {
      waitUntil: "domcontentloaded",
    });
    await fresh.evaluate(() => localStorage.removeItem("shrine-token-v1"));
    const freshShrine = await openShrine(browser, fresh);
    await freshShrine.click("#chooseShrine");
    await freshShrine.waitForFunction(() => {
      const apply = document.getElementById("applyView");
      const gate = document.getElementById("gate");
      return apply && gate && getComputedStyle(gate).display === "flex" && getComputedStyle(apply).display === "block";
    }, { timeout: 15000 });
    const empty = await viewState(freshShrine);
    console.log("no-token shrine", JSON.stringify(empty, null, 2));
    if (empty.chat.display === "flex") fail("chat opened with no token");
    if (empty.applyView.display !== "block") fail("apply view missing without token");
    if (empty.loginBox.display === "none") fail("exported-key login should be available without a token");

    // Pending token: pending view, never username+key.
    const pendPage = await browser.newPage();
    await pendPage.goto(SITE + "/index.html?api=" + encodeURIComponent(API), {
      waitUntil: "domcontentloaded",
    });
    await pendPage.evaluate((tok) => localStorage.setItem("shrine-token-v1", tok), pending.token);
    const pendShrine = await openShrine(browser, pendPage);
    await pendShrine.click("#chooseShrine");
    await pendShrine.waitForFunction(() => {
      const pendingView = document.getElementById("pendingView");
      const gate = document.getElementById("gate");
      const login = document.getElementById("loginBox");
      const pendingOn = pendingView && getComputedStyle(pendingView).display === "block";
      const gateOn = gate && getComputedStyle(gate).display === "flex";
      const loginOn = login && getComputedStyle(login).display !== "none" && login.offsetParent !== null;
      return pendingOn && gateOn && !loginOn;
    }, { timeout: 15000 });
    const pendState = await viewState(pendShrine);
    console.log("pending token restore", JSON.stringify(pendState, null, 2));
    if (pendState.token !== pending.token) fail("pending token was cleared");

    // Dead /status must not wipe shrine-token-v1 (the post-/login logout bug).
    const dead = await browser.newPage();
    await dead.goto(SITE + "/index.html?api=" + encodeURIComponent("http://127.0.0.1:9"), {
      waitUntil: "domcontentloaded",
    });
    await dead.evaluate((tok) => localStorage.setItem("shrine-token-v1", tok), approved.token);
    const deadShrine = await openShrine(browser, dead);
    await deadShrine.click("#chooseShrine");
    await new Promise((r) => setTimeout(r, 1500));
    const deadTok = await deadShrine.evaluate(() => localStorage.getItem("shrine-token-v1"));
    const deadLogin = await deadShrine.evaluate(() => {
      const login = document.getElementById("loginBox");
      return login && getComputedStyle(login).display !== "none" && login.offsetParent !== null;
    });
    if (deadTok !== approved.token) fail("unreachable API cleared the stored token");
    if (deadLogin) fail("unreachable API showed username+key to a token holder");
    console.log("dead API left token intact");

    // Embed without token: username+key required.
    const embed = await browser.newPage();
    await embed.goto(SITE + "/embed/chat.html?api=" + encodeURIComponent(API), {
      waitUntil: "domcontentloaded",
    });
    await embed.waitForSelector("#lu, #loginView", { timeout: 10000 });
    const embedGate = await embed.evaluate(() => {
      const login = document.getElementById("loginView");
      const apply = document.getElementById("applyView");
      const chat = document.getElementById("chat");
      return {
        login: login ? getComputedStyle(login).display : null,
        apply: apply ? getComputedStyle(apply).display : null,
        chat: chat ? getComputedStyle(chat).display : null,
      };
    });
    console.log("embed without token", embedGate);
    if (embedGate.chat === "flex") fail("embed opened chat without credentials");

    const toLogin = await embed.$("#toLogin");
    if (toLogin && embedGate.login !== "block") await toLogin.click();
    await embed.waitForSelector("#lu", { timeout: 5000 });
    await embed.type("#lu", approved.user);
    await embed.type("#lk", approved.token);
    await embed.click("#loginBtn");
    await embed.waitForFunction(() => {
      const chat = document.getElementById("chat");
      return chat && getComputedStyle(chat).display === "flex";
    }, { timeout: 15000 });
    const embedName = await embed.$eval("#u", (el) => el.value);
    if (embedName !== approved.user) fail("embed login username " + embedName);
    console.log("embed username+key login OK");

    console.log("PASS shrine token restore; pending restore; no-token apply; embed login");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
