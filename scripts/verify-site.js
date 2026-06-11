const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const failures = [];
const warnings = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel.replace(/^\//, "")));
}

const htmlFiles = ["index.html", "post.html", "about.html"];
const assetPattern = /(?:href|src)="([^"#?]+)"/g;

for (const file of htmlFiles) {
  if (!exists(file)) {
    failures.push(`Missing HTML: ${file}`);
    continue;
  }
  const content = fs.readFileSync(path.join(root, file), "utf8");
  let match;
  while ((match = assetPattern.exec(content))) {
    const ref = match[1];
    if (ref.startsWith("http") || ref.startsWith("mailto:")) continue;
    if (!exists(ref)) failures.push(`${file} references missing file: ${ref}`);
  }
}

const postsSrc = fs.readFileSync(path.join(root, "js/posts.js"), "utf8");
const ids = [...postsSrc.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueIds = new Set(ids);

if (uniqueIds.size !== ids.length) {
  failures.push("Duplicate post IDs in posts.js");
}

if (!exists("post.html")) {
  failures.push("post.html missing");
}

for (const js of ["js/posts.js", "js/app.js", "js/post.js"]) {
  try {
    new Function(fs.readFileSync(path.join(root, js), "utf8"));
  } catch (err) {
    failures.push(`JS parse error in ${js}: ${err.message}`);
  }
}

if (!postsSrc.includes("function getPostById")) {
  failures.push("getPostById missing from posts.js");
}

const tags = [...postsSrc.matchAll(/tag:\s*"([^"]+)"/g)].map((m) => m[1]);
const tagSet = new Set(tags);

console.log("=== Superpowers verification audit ===");
console.log(`HTML files checked: ${htmlFiles.length}`);
console.log(`Post count: ${ids.length}`);
console.log(`Unique post IDs: ${uniqueIds.size}`);
console.log(`Tags: ${[...tagSet].join(", ")}`);
console.log("");

if (warnings.length) {
  console.log(`WARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
}

if (failures.length) {
  console.log(`FAILURES (${failures.length}):`);
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}

console.log("RESULT: All checks passed (exit 0)");
