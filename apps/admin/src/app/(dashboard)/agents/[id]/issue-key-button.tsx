"use client";

import { useState } from "react";
import { Button } from "@repo/admin-ui/primitives";
import { IssueKeyDialog } from "./issue-key-dialog";

export function IssueKeyButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Emitir key
      </Button>
      {open && <IssueKeyDialog clientId={clientId} onClose={() => setOpen(false)} />}
    </>
  );
}
