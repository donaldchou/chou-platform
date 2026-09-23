import type { Material, Supplier } from "./types";

const digits = (s: string) => s.replace(/\D/g, "");

/** 把搜尋字串拆成關鍵字（空白分隔） */
export const searchTerms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * 搜尋貨源店家：每個關鍵字都要符合（AND）。
 * 比對店名、店家電話、地址、備註、聯絡人姓名與電話，以及這家店供應的資材名稱。
 * 電話比對時忽略「-」與空白，例如 0963451651 可以找到 0963-451651。
 */
export function searchSuppliers(suppliers: Supplier[], materials: Material[], query: string) {
  const terms = searchTerms(query);
  if (!terms.length) return suppliers.map((s) => ({ s, materialHits: [] as string[] }));

  return suppliers.flatMap((s) => {
    const supplied = materials.filter((m) => m.supplierId === s.id);
    const contacts = s.contacts ?? [];
    const text = [s.name, s.phone, s.address, s.note, ...contacts.flatMap((c) => [c.name, c.phone])]
      .join(" ")
      .toLowerCase();
    const phoneDigits = [s.phone, ...contacts.map((c) => c.phone)].map(digits).join(" ");
    const materialHits = new Set<string>();

    const ok = terms.every((term) => {
      if (text.includes(term)) return true;
      // 看起來像電話號碼（只有數字、- 或空白，至少 3 碼）才用數字比對
      const d = digits(term);
      if (d.length >= 3 && d.length === term.replace(/[\s-]/g, "").length && phoneDigits.includes(d)) return true;
      const hits = supplied.filter((m) => `${m.nameZh} ${m.nameEn}`.toLowerCase().includes(term));
      hits.forEach((m) => materialHits.add(m.nameZh));
      return hits.length > 0;
    });
    return ok ? [{ s, materialHits: [...materialHits] }] : [];
  });
}
