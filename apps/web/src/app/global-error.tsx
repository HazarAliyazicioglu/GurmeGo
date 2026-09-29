"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Next.js App Router convention: error.tsx only catches errors inside the root layout's
// children -- a crash in the root layout itself (e.g. globals.css import, root providers) skips
// error.tsx entirely and needs this separate file, which replaces <html>/<body> since the layout
// that would normally render them is what crashed.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  // No-op without NEXT_PUBLIC_SENTRY_DSN (src/lib/sentry.ts) -- safe to call unconditionally.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <main>
          <h1>Bir şeyler ters gitti</h1>
          <p>Sayfa yüklenirken beklenmeyen bir hata oluştu. Sayfayı yenilemeyi dene.</p>
        </main>
      </body>
    </html>
  );
}
