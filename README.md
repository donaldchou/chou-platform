# CHOU 農場管理平台

管理多個果園的水電費、套袋、採收、施肥、噴藥、剪枝、砍草紀錄，以及資材、店家、外請工人與員工。

- 前端：Next.js 16（App Router）+ Tailwind CSS v4
- 後端：Next.js Route Handlers + Mongoose 9 + MongoDB Atlas

## 開發

```bash
npm install
npm run dev
```

`.env.local`：

```
MONGODB_URI=mongodb+srv://...     # 必填
BLOB_READ_WRITE_TOKEN=...         # 必填，照片存放（Vercel Blob，private store）
GEMINI_API_KEY=...                # 選填，噴藥 AI 建議；沒設定時使用內建建議
SUPPLIER_CODE=...                 # 必填，新增／編輯／刪除貨源店家時要輸入的驗證碼
FERTILIZER_CODE=...               # 必填，新增／編輯／刪除肥料時要輸入的驗證碼
```

## 程式結構

| 路徑 | 說明 |
|---|---|
| `src/lib/mongodb.ts` | 共用的 MongoDB 連線（`connectDB()`），dev 模式用 global 快取 |
| `src/models/` | Mongoose schema |
| `src/lib/collections.ts` | API 路徑 ↔ model 對照、可篩選欄位、排序 |
| `src/lib/repo.ts` | 資料存取與商業規則 |
| `src/app/api/` | API routes |
| `src/lib/store.ts` | 前端資料快取（載入 `/api/db`，樂觀更新後寫回 API） |
| `src/lib/types.ts` | 前後端共用的資料型別 |

## 資料模型

所有文件的 `_id` 都是字串，API 輸出時轉成 `id`。子文件（地號、進場紀錄、配方…）保留自己的 `id` 欄位。

| 集合 | Model | 內容 |
|---|---|---|
| `orchards` | Orchard | 果園：中英文名稱、照片、地號（經緯度／地目／面積）、取得資訊、合約、果樹數量、水塔、馬達、噴藥管線、電網、待嫁接／待重新種植、水塔管線照片、電號 |
| `bills` | Bill | 水費／電費繳費單（`kind`: water / electricity） |
| `bagging` | Bagging | 套袋：員工、紙袋箱數、外請工人、進場紀錄、便當、每袋工資、工資結算 |
| `harvests` | Harvest | 採收開始／結束 |
| `fertilizing` | Fertilizing | 施肥：肥料與每棵樹用量、包數、對象、員工、參考照片 |
| `spraying` | Spraying | 噴藥：用水量、藥品（陣列順序＝加入順序）、對象、AI 建議 |
| `labor` | Labor | 剪枝／砍草（`kind`: pruning / weeding）：外請工人日薪、進場紀錄、工資結算 |
| `suppliers` | Supplier | 貨源店家：店家電話、聯絡人與電話（最多 3 組）、地址、名片（多張） |
| `materials` | Material | 農藥／肥料／包材（`category`），含歷史價格、多張照片；`targets` 在農藥是「防治對象」、在肥料是「成分說明」 |
| `workers` | Worker | 外請工人 |
| `employees` | Employee | 自己員工 |
| `tasks` | Task | 工作指派與回報 |
| `salaries` | Salary | 薪水 |
| `bonuses` | Bonus | 分紅 |

## API

### 通用 CRUD（上面所有集合）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/<集合>` | 列表，可篩選（例：`/api/bills?kind=water&orchardId=o1&from=2026-01&to=2026-12`） |
| POST | `/api/<集合>` | 新增，回 201；id 重複回 409 |
| GET | `/api/<集合>/<id>` | 單筆，找不到回 404 |
| PUT | `/api/<集合>/<id>` | 整筆儲存，不存在時建立 |
| DELETE | `/api/<集合>/<id>` | 刪除，回 204 |

可篩選欄位：bills（orchardId, kind）、materials（category, supplierId）、labor（orchardId, kind）、tasks（employeeId, orchardId, status）、salaries／bonuses（employeeId），其他紀錄（orchardId）。`from`／`to` 依各集合的主要日期欄位篩選。

### 商業規則

- **資料驗證**：必填欄位、列舉值、日期格式（`YYYY-MM-DD`、`YYYY-MM`）、金額不可為負，錯誤回 400。
- **關聯檢查**：紀錄的 `orchardId`、薪水／分紅／工作的 `employeeId` 必須存在。
- **資材價格歷史**：價格變動時，後端自動把舊價格加進 `priceHistory`，並更新「資訊異動時間」。
- **刪除果園**：底下還有紀錄時回 409 和各類紀錄筆數；帶 `?cascade=true` 才會一併刪除。
- **驗證碼**：新增／編輯／刪除貨源店家（`SUPPLIER_CODE`）與肥料（`FERTILIZER_CODE`；農藥改成肥料也算）時，必須帶 `x-verify-code` 標頭（值用 `encodeURIComponent` 編碼），相符才會執行，否則回 403。規則定義在 `src/lib/codes.ts`。
- **照片**：瀏覽器先壓縮成 JPEG（最長邊 1600px），上傳到 Vercel Blob 的 `chou-platform/<folder>/`，MongoDB 只存檔案網址（base64 會被拒絕）。編輯時移除的照片、刪除資料（含果園連帶刪除的紀錄）時的照片，會自動從 Blob 刪除。

### 其他

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/upload` | 上傳照片（multipart：`file`、`folder`），回傳 `{ url }` |
| GET | `/api/photo?url=` | 讀取照片（private store 不能直接開啟網址） |
| POST | `/api/verify-code` | 只檢查驗證碼，body：`{ collection, action: "create" \| "update" \| "delete", code, category? }` |
| GET | `/api/db` | 一次取得所有資料（前端啟動時使用） |
| GET | `/api/health` | 檢查資料庫連線 |
| GET | `/api/reminders?days=90` | 合約到期（預設 3 個月內）、逾期工作、有禁用期的資材、待完成事項；可給排程推播用 |
| GET | `/api/stats/bills?kind=water&year=2026&orchardId=o1` | 水電費每月、歷年、各果園統計 |
| POST | `/api/ai/spray-advice` | 噴藥 AI 建議，body：`{ stage, targets, waterLiters, materialIds }` |

## 尚未實作

- 登入與權限：目前任何能連到網站的人都能讀寫資料
- 上傳照片後按「取消」不儲存，已上傳的照片會留在 Blob 中（未被任何資料使用）
