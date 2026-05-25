// One-off: build samples/manifest.json from the .txt files + a company map.
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "samples");

// companyBase -> { label, domain }  (domain drives the logo)
const MAP = {
  apple: ["Apple", "apple.com"], atlassian: ["Atlassian", "atlassian.com"], cloudflare: ["Cloudflare", "cloudflare.com"],
  discord: ["Discord", "discord.com"], dropbox: ["Dropbox", "dropbox.com"], duckduckgo: ["DuckDuckGo", "duckduckgo.com"],
  ea: ["EA", "ea.com"], ebay: ["eBay", "ebay.com"], figma: ["Figma", "figma.com"], github: ["GitHub", "github.com"],
  gitlab: ["GitLab", "gitlab.com"], google: ["Google", "google.com"], hubspot: ["HubSpot", "hubspot.com"],
  ibm: ["IBM", "ibm.com"], linkedin: ["LinkedIn", "linkedin.com"], lyft: ["Lyft", "lyft.com"],
  microsoft: ["Microsoft", "microsoft.com"], mozilla: ["Firefox", "mozilla.org"], netflix: ["Netflix", "netflix.com"],
  nintendo: ["Nintendo", "nintendo.com"], nvidia: ["NVIDIA", "nvidia.com"], oracle: ["Oracle", "oracle.com"],
  paypal: ["PayPal", "paypal.com"], proton: ["Proton", "proton.me"], robinhood: ["Robinhood", "robinhood.com"],
  salesforce: ["Salesforce", "salesforce.com"], samsung: ["Samsung", "samsung.com"], shopify: ["Shopify", "shopify.com"],
  signal: ["Signal", "signal.org"], slack: ["Slack", "slack.com"], spotify: ["Spotify", "spotify.com"],
  stripe: ["Stripe", "stripe.com"], telegram: ["Telegram", "telegram.org"], tiktok: ["TikTok", "tiktok.com"],
  verizon: ["Verizon", "verizon.com"], vimeo: ["Vimeo", "vimeo.com"], whatsapp: ["WhatsApp", "whatsapp.com"],
  wikipedia: ["Wikipedia", "wikipedia.org"], yahoo: ["Yahoo", "yahoo.com"], zendesk: ["Zendesk", "zendesk.com"],
  snapchat: ["Snapchat", "snap.com"], sony: ["Sony / PSN", "sony.com"], tumblr: ["Tumblr", "tumblr.com"],
  wise: ["Wise", "wise.com"], wordpress: ["WordPress", "wordpress.com"], x: ["X / Twitter", "x.com"], zoom: ["Zoom", "zoom.us"],
};

const entries = readdirSync(dir)
  .filter((f) => f.endsWith(".txt"))
  .map((f) => {
    const base = f.replace(/\.txt$/, "");
    const type = base.endsWith("_tos") ? "tos" : "privacy";
    const companyBase = base.replace(/_(tos|priv)$/, "");
    const m = MAP[companyBase];
    if (!m) { console.warn("NO MAP for", companyBase); return null; }
    return { file: f, label: m[0], type, domain: m[1] };
  })
  .filter(Boolean)
  .sort((a, b) => (a.type === b.type ? a.label.localeCompare(b.label) : a.type === "privacy" ? -1 : 1));

writeFileSync(join(dir, "manifest.json"), JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} entries (${entries.filter((e) => e.type === "privacy").length} privacy, ${entries.filter((e) => e.type === "tos").length} tos)`);
