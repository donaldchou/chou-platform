"use client";

import { useState } from "react";
import { OrchardForm } from "@/components/orchard-form";
import { PageHeader } from "@/components/ui";
import { emptyOrchard } from "@/lib/defaults";

export default function NewOrchardPage() {
  const [initial] = useState(emptyOrchard);
  return (
    <>
      <PageHeader title="新增果園" desc="填寫果園基本資料，之後都可以再修改。" />
      <OrchardForm initial={initial} isNew />
    </>
  );
}
