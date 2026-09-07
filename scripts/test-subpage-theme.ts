const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const css = await Deno.readTextFile(`${ROOT}/assets/css/site.css`);

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

must(css.includes("--card: #1c1914;"), "dark theme needs a dark card token");
must(css.includes("--band: #0c0b09;"), "dark theme needs a dark band token");
must(css.includes(".card {\n  background: var(--card);"), "cards must use the theme card token");
must(css.includes(".topbar { background: var(--band);"), "topbar must stay on the dark band");
must(css.includes(".footer { background: var(--band);"), "footer must stay on the dark band");
must(css.includes("section.ink { background: var(--band);"), "ink sections must stay on the dark band");
must(!css.includes(".card {\n  background: #fff;"), "cards must not hard-code white");
must(!css.includes(".topbar { background: var(--ink-900);"), "topbar must not use ink-900 as a background");
must(!css.includes(".footer { background: var(--ink-900);"), "footer must not use ink-900 as a background");

const pages = [
  "methodology.html", "curriculum.html", "tutors.html", "pricing.html",
  "resources.html", "outcomes.html", "faq.html", "contact.html",
  "blog.html", "policies.html", "testimonials.html", "sitemap.html",
];
for (const page of pages) {
  const html = await Deno.readTextFile(`${ROOT}/${page}`);
  must(html.includes("assets/css/site.css?v=5"), page + " must load the themed stylesheet");
  must(html.includes("untether-theme"), page + " must apply the stored theme before paint");
}

console.log("subpage theme tokens ok");
