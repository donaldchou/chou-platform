import { Schema } from "mongoose";
import { defineModel, idField, str } from "./_shared";

export const USER_ROLES = ["admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * 登入帳號。不放進 COLLECTIONS：通用 CRUD API 和 /api/db 都碰不到，只能經 /api/auth、/api/admin/users 存取。
 * 密碼只存 bcrypt 雜湊，輸出給前端前一定要用 publicUser() 拿掉。
 */
const UserSchema = new Schema(
  {
    _id: idField,
    email: {
      type: String,
      required: [true, "請填寫 email"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email 格式不正確"],
    },
    passwordHash: { type: String, required: true },
    name: str,
    role: { type: String, enum: USER_ROLES, default: "user" }, // 身分：admin＝管理者、user＝一般使用者
    active: { type: Boolean, default: true }, // 停用的帳號不能登入
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const UserModel = defineModel("User", UserSchema, "users");
