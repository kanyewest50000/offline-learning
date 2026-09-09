#!/usr/bin/env -S deno run --allow-read
// One god portrait per message, however many :tung::tung::tung::sahur: combos
// are in it. Combos after the first fall back to bats + the inline sahur png.
//
// Both chat clients render messages off the same relay, so they have to agree:
// the shrine chat (assets/js/shrine/chat.js, a source string written into the
// about:blank window) and the standalone embed (embed/chat.html).

import { readShrineFile, ROOT } from "./shrine-sources.ts";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Pull a named function out of a blob of source by brace matching. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error("missing " + name);
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error("unclosed " + name);
}

/* The shrine client is a string built by concatenation, so run the module to
   get the source the browser would actually see. */
const chatModule = await readShrineFile("assets/js/shrine/chat.js");
const win: { Shrine: Record<string, unknown> } = {
  Shrine: { LBL: { POPUP: "popup", ORIGINALS: "originals" } },
};
const loc = { href: "https://example.test/index.html", search: "" };
new Function("window", "location", chatModule)(win, loc);
const shrineSrc = win.Shrine.CHAT_JS as string;
const embedSrc = await Deno.readTextFile(`${ROOT}/embed/chat.html`);

/* Enough DOM for renderBody: it only makes elements, text nodes, and appends. */
type Node = { tag: string; cls: string; text: string; kids: Node[] };
function stubDoc() {
  const make = (tag: string): Node => ({ tag, cls: "", text: "", kids: [] });
  return {
    createElement: (t: string) => {
      const n = make(t) as Node & { className: string; appendChild: (k: Node) => void };
      Object.defineProperty(n, "className", { get: () => n.cls, set: (v) => (n.cls = v) });
      n.appendChild = (k: Node) => void n.kids.push(k);
      return n;
    },
    createTextNode: (t: string) => ({ ...make("#text"), text: t }),
  };
}
function walk(n: Node, out: Node[] = []): Node[] {
  for (const k of n.kids ?? []) { out.push(k); walk(k, out); }
  return out;
}

function renderer(src: string) {
  const defs = 'var EMOJI={"tung":"\u{1F3CF}","sob":"\u{1F62D}"};' +
    fn(src, "makeSahurSvg") + fn(src, "makeGodCombo") +
    fn(src, "renderInline") + fn(src, "renderBody");
  const build = new Function(
    "document", "TUNG_IMG", "TUNGGOD_IMG", "GOD_IMG", "SAHUR_IMG",
    defs + "; return renderBody;",
  );
  const doc = stubDoc();
  const renderBody = build(doc, "t.png", "god.png", "god.png", "t.png");
  return (text: string) => {
    const root = doc.createElement("div");
    renderBody(root, text);
    const nodes = walk(root);
    return {
      gods: nodes.filter((n) => n.cls === "embed god").length,
      sahurs: nodes.filter((n) => n.cls === "isvg").length,
      text: nodes.map((n) => n.text).join(""),
    };
  };
}

const C = ":tung::tung::tung::sahur:";
const cases: [string, string, number][] = [
  ["no combo", "hello :tung: world", 0],
  ["one combo", C, 1],
  ["one combo, spaced", ":tung: :tung: :tung: :sahur:", 1],
  ["two combos", C + C, 1],
  ["three combos", `${C} ${C} ${C}`, 1],
  ["ten combos", C.repeat(10), 1],
  ["combos with text between", `before ${C} middle ${C} after`, 1],
  ["lone :sahur:", "just :sahur: alone", 0],
  ["combo then lone :sahur:", `${C} and :sahur:`, 1],
];

const shrine = renderer(shrineSrc);
const embed = renderer(embedSrc);

for (const [name, text, wantGods] of cases) {
  const a = shrine(text);
  const b = embed(text);
  must(a.gods === wantGods, `shrine: "${name}" embedded ${a.gods} portraits, expected ${wantGods}`);
  must(b.gods === wantGods, `embed: "${name}" embedded ${b.gods} portraits, expected ${wantGods}`);
  must(a.gods <= 1, `shrine: "${name}" embedded more than one portrait`);
  must(b.gods <= 1, `embed: "${name}" embedded more than one portrait`);
  must(
    JSON.stringify(a) === JSON.stringify(b),
    `"${name}" renders differently: shrine ${JSON.stringify(a)} vs embed ${JSON.stringify(b)}`,
  );
}

/* the combos past the first still render, just as bats + the inline sahur png */
const three = shrine(`${C} ${C} ${C}`);
must(three.sahurs === 2, "combos after the first must still show their inline :sahur:");
must((three.text.match(/\u{1F3CF}/gu) || []).length === 6, "combos after the first must still show their bats");

console.log(`god-combo limit: one portrait per message, ${cases.length} cases, shrine and embed agree`);
