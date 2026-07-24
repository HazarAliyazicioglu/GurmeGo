"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { importCsv } from "@/lib/api";
import type { CsvImportResult } from "@gurmego/shared";

export default function ImportPage() {
  const { session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!session?.access_token || !file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await importCsv(session.access_token, file);
      setResult(res);
    } catch {
      setError("Yükleme başarısız oldu. Dosyayı kontrol edip tekrar dene.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main data-testid="import-page">
      <h1>CSV Toplu Import</h1>
      <label htmlFor="csv-file">CSV dosyası</label>
      <input
        id="csv-file"
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button onClick={handleUpload} disabled={!file || uploading}>
        Yükle
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div data-testid="import-result">
          <p>{result.created} mekan oluşturuldu, {result.skipped} atlandı (zaten var)</p>
          {result.errors.length > 0 && (
            <ul>
              {result.errors.map((err) => (
                <li key={err.row}>Satır {err.row}: {err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
