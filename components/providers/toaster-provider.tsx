"use client";

import { Toaster } from "sonner";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        className: "!bg-surface !border !border-border !text-text"
      }}
    />
  );
}
