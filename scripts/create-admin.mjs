/**
 * 一次性建立管理員帳號（沒有註冊頁，第一個管理者用這支建立，其他人由後台新增）。
 *
 *   用法（PowerShell）：
 *     $env:ADMIN_PASSWORD = "密碼"; node scripts/create-admin.mjs 你的@email.com; Remove-Item Env:ADMIN_PASSWORD
 *
 * - 讀 .env.local 的 MONGODB_URI，密碼用 bcrypt 雜湊後才存進 users 集合。
 * - 這個 email 已經有帳號就不會覆寫，直接結束；要重設密碼請加 --reset。
 * - 密碼用環境變數傳，不放在指令參數裡，避免留在指令歷史。
 */
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("請給管理員 email：node scripts/create-admin.mjs you@example.com");
  process.exit(1);
}
if (password.length < 8) {
  console.error("請用環境變數 ADMIN_PASSWORD 傳入密碼（至少 8 個字元）");
  process.exit(1);
}

loadEnv();
if (!process.env.MONGODB_URI) {
  console.error(".env.local 沒有 MONGODB_URI");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const users = mongoose.connection.db.collection("users");
// 與 src/models/user.ts 的 unique index 相同；第一次建立時集合還不存在
await users.createIndex({ email: 1 }, { unique: true });

const existing = await users.findOne({ email });
const passwordHash = await bcrypt.hash(password, 12);
const now = new Date();

if (existing && !reset) {
  console.log(`${email} 已經有帳號（身分：${existing.role}），沒有做任何修改。要重設密碼請加 --reset。`);
} else if (existing) {
  await users.updateOne({ _id: existing._id }, { $set: { passwordHash, role: "admin", active: true, updatedAt: now } });
  console.log(`已重設 ${email} 的密碼，並設為管理者。`);
} else {
  await users.insertOne({
    _id: Math.random().toString(36).slice(2, 10),
    email,
    passwordHash,
    name: "",
    role: "admin",
    active: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`已建立管理者帳號 ${email}。`);
}
await mongoose.disconnect();
