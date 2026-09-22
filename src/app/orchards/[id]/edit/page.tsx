"use client";

import { useParams } from "next/navigation";
import { OrchardForm } from "@/components/orchard-form";
import { Empty, PageHeader } from "@/components/ui";
import { useDB, useDBStatus } from "@/lib/store";

export default function EditOrchardPage() {
  const { id } = useParams<{ id: string }>();
  const db = useDB();
  const { ready } = useDBStatus();
  const orchard = db.orchards.find((o) => o.id === id);

  if (!ready) return null;
  if (!orchard) return <Empty>找不到這個果園。</Empty>;

  return (
    <>
      <PageHeader title={`編輯：${orchard.nameZh}`} />
      <OrchardForm key={orchard.id} initial={orchard} isNew={false} />
    </>
  );
}
