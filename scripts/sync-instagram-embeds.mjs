import fs from "node:fs";
import vm from "node:vm";

const dataPath = new URL("../data/fomo-referrals.js", import.meta.url);
const source = fs.readFileSync(dataPath, "utf8");
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const dashboard = sandbox.window.FOMO_DASHBOARD;
const posts = dashboard.instagram.posts || [];

function numberFrom(text) {
  return Number(String(text || "").replace(/,/g, ""));
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

for (const post of posts) {
  if (!post.url) continue;
  const embedUrl = post.url.replace(/\/?$/, "/embed/");
  const res = await fetch(embedUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 FOMO-dashboard-sync",
      "accept": "text/html"
    }
  });
  if (!res.ok) {
    console.warn(`Skipped ${post.url}: ${res.status}`);
    continue;
  }

  const html = await res.text();
  const likes = firstMatch(html, [
    /([0-9][0-9,]*) likes/i,
    /"edge_liked_by":\{"count":([0-9]+)/i
  ]);
  const followers = firstMatch(html, [
    /([0-9][0-9,]*) followers/i,
    /([0-9][0-9,]*) follower/i
  ]);

  if (likes !== null) post.likes = numberFrom(likes);
  if (followers !== null) dashboard.instagram.profileFollowers = numberFrom(followers);
  post.syncedAt = new Date().toISOString();
}

dashboard.updatedAt = new Date().toISOString();

const output = `window.FOMO_DASHBOARD = ${JSON.stringify(dashboard, null, 2)};\n\nwindow.FOMO_REFERRALS = {\n  updatedAt: window.FOMO_DASHBOARD.updatedAt,\n  entries: window.FOMO_DASHBOARD.referrals\n};\n`;

fs.writeFileSync(dataPath, output);
