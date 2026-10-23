/**
 * 把整個資料庫（.env.local 的 MONGODB_URI 那個）備份成一個壓縮檔。備份裡是真實資料，預設存在專案外面，不會進 git。
 *
 *   npm run backup                    → C:\backup\Personal\AI\chou-platform-backup\chou-platform_YYYYMMDD_HHmm.jsonl.gz
 *   npm run backup -- --out D:\備份   → 改存到別的資料夾（也可設環境變數 BACKUP_DIR）
 *
 * 檔案格式（gzip 壓縮的 JSON Lines，Canonical EJSON，ObjectId／Date 型別原樣保留）：
 *   第一行  {"database", "createdAt", "collections": [{name, indexes}]}
 *   中間    {"c": collection 名稱, "d": 文件}，同一個 collection 的文件連在一起
 *   最後一行 {"counts": {名稱: 筆數}}（缺這行代表檔案不完整）
 * 還原用 npm run restore（見 scripts/restore-db.mjs）。照片在 Vercel Blob，不在備份裡。
 */
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import mongoose from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DEFAULT_DIR = "C:\\backup\\Personal\\AI\\chou-platform-backup";
const { EJSON } = mongoose.mongo.BSON;

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

loadEnv();
if (!process.env.MONGODB_URI) {
  console.error(".env.local 沒有 MONGODB_URI");
  process.exit(1);
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const dir = argValue("--out") ?? process.env.BACKUP_DIR ?? DEFAULT_DIR;
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${db.databaseName}_${stamp()}.jsonl.gz`);
  console.log(`備份 ${db.databaseName} → ${file}`);

  const names = (await db.listCollections({}, { nameOnly: false }).toArray())
    .filter((c) => c.type === "collection" && !c.name.startsWith("system."))
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b));
  const collections = [];
  for (const name of names) collections.push({ name, indexes: await db.collection(name).listIndexes().toArray() });

  const counts = {};
  async function* lines() {
    yield JSON.stringify({ database: db.databaseName, createdAt: new Date().toISOString(), collections }) + "\n";
    for (const name of names) {
      counts[name] = 0;
      for await (const doc of db.collection(name).find({}, { batchSize: 1000 })) {
        counts[name]++;
        yield EJSON.stringify({ c: name, d: doc }, { relaxed: false }) + "\n";
      }
      console.log(`  ${name.padEnd(20)} ${String(counts[name]).padStart(7)} 筆`);
    }
    yield JSON.stringify({ counts }) + "\n";
  }
  await pipeline(Readable.from(lines()), createGzip(), createWriteStream(file));

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(`完成：${names.length} 個 collection，共 ${total} 筆`);
} catch (e) {
  console.error("備份失敗：", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
