/**
 * 把舊的 Vercel Blob 照片搬到 ll3 主機，並把資料庫裡的網址改成 "ll3:folder/name"。
 *
 *   node scripts/migrate-blob-to-ll3.mjs                      → 只統計（資料庫有幾個 Blob 網址、幾個已經搬過）
 *   node scripts/migrate-blob-to-ll3.mjs --upload             → 下載 Blob、上傳到 ll3、核對大小（不改資料庫）
 *   node scripts/migrate-blob-to-ll3.mjs --apply              → 改寫資料庫網址（要先全部 --upload 完）
 *   --db <名稱>   預設 chou-platform-restore（演練用，先 npm run restore 一份進去）
 *   --db chou-platform --apply 要再加 --yes-live 才會改正式資料庫
 *
 * 對照表存在 C:\backup\Personal\AI\chou-platform-backup\ll3-migration-map.json（可重複執行，已搬過的會跳過）。
 * Blob 上的舊檔不會刪除，確認沒問題後再到 Vercel 清掉。
 */
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { get } from "@vercel/blob";
import mongoose from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const MAP_FILE = "C:\\backup\\Personal\\AI\\chou-platform-backup\\ll3-migration-map.json";
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\/chou-platform\//i;
const LL3_PATH = /^[a-z0-9-]{1,40}\/[A-Za-z0-9_-]{1,100}\.[a-z0-9]{1,5}$/;
const CHUNK = 150_000;
const LL3_FILE_API = "http://www.ll3.com.tw/platform/file_api.asp"; // 同 src/lib/ll3.ts

loadEnv();
const dbName = argValue("--db") ?? "chou-platform-restore";
const doUpload = process.argv.includes("--upload");
const doApply = process.argv.includes("--apply");
for (const k of ["MONGODB_URI", "BLOB_READ_WRITE_TOKEN", "LL3_FILE_KEY"]) {
  if (!process.env[k]) {
    console.error(`.env.local 沒有 ${k}`);
    process.exit(1);
  }
}
if (doApply && dbName === "chou-platform" && !process.argv.includes("--yes-live")) {
  console.error("要改正式資料庫 chou-platform，請加 --yes-live（先 npm run backup）");
  process.exit(1);
}

/* ---------- ll3 檔案 API（同 src/lib/ll3.ts） ---------- */
function signedUrl(a, { p = "", id = "", n = "", size = "" } = {}) {
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", process.env.LL3_FILE_KEY).update([a, p, id, n, size, ts].join("|")).digest("hex");
  return `${LL3_FILE_API}?${new URLSearchParams({ a, p, id, n: String(n), size: String(size), ts, sig })}`;
}

async function call(a, params, init) {
  const res = await fetch(signedUrl(a, params), init);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(`ll3 ${a} 失敗（HTTP ${res.status}）：${data?.error ?? "回應不是 JSON"}`);
  return data;
}

async function upload(path, bytes) {
  const id = randomBytes(12).toString("hex");
  for (let i = 0, n = 0; i < bytes.length; i += CHUNK, n++) {
    await call("put", { id, n }, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes.subarray(i, i + CHUNK) });
  }
  await call("done", { id, p: path, size: bytes.length });
}

/** Blob 路徑 chou-platform/<folder>/<name>.<ext> → ll3 路徑 <folder>/<name>.<ext>（不合規則的字元換成 -） */
function ll3PathOf(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean).slice(1);
  const folder = (parts.length > 1 ? parts[0] : "photos").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  const file = decodeURIComponent(parts[parts.length - 1]);
  const dot = file.lastIndexOf(".");
  const ext = (dot > 0 ? file.slice(dot + 1) : "jpg").toLowerCase().replace("jpeg", "jpg");
  const base = (dot > 0 ? file.slice(0, dot) : file).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
  const path = `${folder}/${base}.${ext}`;
  if (!LL3_PATH.test(path)) throw new Error(`無法轉換路徑：${url}`);
  return path;
}

/* ---------- 掃描資料庫 ---------- */
// 只往一般物件裡找（ObjectId、Date 等 BSON 型別原樣保留）
const isPlain = (v) => v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;

function collect(value, out) {
  if (typeof value === "string") {
    if (BLOB_URL.test(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => collect(v, out));
  else if (isPlain(value)) {
    Object.values(value).forEach((v) => collect(v, out));
  }
  return out;
}

function replaceUrls(value, map) {
  if (typeof value === "string") return map[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceUrls(v, map));
  if (isPlain(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceUrls(v, map)]));
  }
  return value;
}

const map = existsSync(MAP_FILE) ? JSON.parse(readFileSync(MAP_FILE, "utf8")) : {};
const saveMap = () => {
  mkdirSync(dirname(MAP_FILE), { recursive: true });
  writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
};

try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  const db = mongoose.connection.db;
  console.log(`資料庫 ${db.databaseName}`);
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."));

  const urls = new Set();
  const docsWithUrls = []; // [collection, _id]
  for (const name of names) {
    let count = 0;
    for await (const doc of db.collection(name).find()) {
      const found = collect(doc, new Set());
      if (found.size) {
        found.forEach((u) => urls.add(u));
        docsWithUrls.push([name, doc._id]);
        count++;
      }
    }
    if (count) console.log(`  ${name.padEnd(16)} ${count} 筆資料有 Blob 網址`);
  }
  const pending = [...urls].filter((u) => !map[u]);
  console.log(`Blob 網址 ${urls.size} 個，已搬 ${urls.size - pending.length}，未搬 ${pending.length}`);

  if (doUpload) {
    let i = 0;
    for (const url of pending) {
      i++;
      const path = ll3PathOf(url);
      const r = await get(url, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (!r || r.statusCode !== 200) {
        console.warn(`  [${i}/${pending.length}] Blob 讀不到，跳過：${url}`);
        continue;
      }
      const bytes = new Uint8Array(await new Response(r.stream).arrayBuffer());
      const stat = await call("stat", { p: path });
      if (stat.exists && stat.size !== bytes.length) throw new Error(`ll3 已有不同大小的 ${path}（${stat.size} ≠ ${bytes.length}）`);
      if (!stat.exists) await upload(path, bytes);
      const check = await call("stat", { p: path });
      if (!check.exists || check.size !== bytes.length) throw new Error(`上傳後大小不符：${path}`);
      map[url] = `ll3:${path}`;
      saveMap();
      console.log(`  [${i}/${pending.length}] ${stat.exists ? "已存在" : "已上傳"} ${path}（${bytes.length} bytes）`);
    }
  }

  if (doApply) {
    const missing = [...urls].filter((u) => !map[u]);
    if (missing.length) throw new Error(`還有 ${missing.length} 個網址沒搬，請先 --upload`);
    let changed = 0;
    for (const [name, _id] of docsWithUrls) {
      const doc = await db.collection(name).findOne({ _id });
      if (!doc) continue;
      const next = replaceUrls(doc, map);
      const r = await db.collection(name).replaceOne({ _id }, next);
      changed += r.modifiedCount;
    }
    console.log(`已改寫 ${changed} 筆資料`);
    const left = new Set();
    for (const name of names) for await (const doc of db.collection(name).find()) collect(doc, left);
    console.log(`改寫後剩下 Blob 網址：${left.size} 個`);
  }
} catch (e) {
  console.error("失敗：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
