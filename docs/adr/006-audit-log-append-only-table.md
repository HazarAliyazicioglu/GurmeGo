# ADR 006: Hesap verebilirlik kaydı — aynı DB'de DB-seviyesinde append-only `AuditLog`
Tarih: 2026-09-21 · Sürüm: v2 (aynı gün, `plan-red-team` sonrası revize)

## Bağlam
`docs/DENETIM-RAPORU.md` §1.2 Orta: rol atama ve toplu CSV yükleme "kim, ne zaman, ne yaptı" bilgisini hiçbir yerde
bırakmıyor. `VenueVersion` mekan düzenlemeleri için snapshot tutuyor ama `createdBy` her yerde `null`. Rol/yetki değişikliği
büyük ölçekli üründe standart denetim beklentisi; ele geçirilmiş bir admin hesabının geriye dönük izi yok.

## Seçenekler
1. **Aynı Postgres'te `AuditLog`, işlemle aynı transaction'da, DB trigger'ı ile append-only.** artı: atomik (tek-kayıtlı işlemlerde),
   yeni altyapı yok (ADR 001 ruhu), sorgulanabilir, append-only uygulama rolüne rağmen DB tarafından zorlanır. eksi: DB süper-kullanıcısı
   trigger'ı kaldırabilir (tamper-evident değil).
2. **Yapısal log (pino) → log servisi.** artı: DB'den bağımsız. eksi: atomik değil, log servisi yok (Plan 4e), sorgulanabilirlik zayıf.
3. **Yalnız `VenueVersion.createdBy`.** artı: en ucuz. eksi: rol atama ve CSV import'u kapsamaz.

## Karar
Seçenek 1, şu sözleşmeyle:
- **Atomiklik yalnız tek-kayıtlı işlemler için** (rol atama, mekan create/update/revert, kuyruk approve/reject): kayıt aynı `$transaction`'da; audit
  INSERT'i başarısızsa ana işlem de geri alınır (**fail-closed**). `AuditService.record` yalnız `Prisma.TransactionClient` kabul eder.
- **CSV import atomik DEĞİL** (satır-bazlı kısmi başarı mevcut ürün davranışı): *niyet-önce-etki* — işlemden önce `CSV_IMPORT_STARTED` (yazılamazsa import
  başlamaz), sonra `CSV_IMPORTED` özeti (yazılamazsa loglanır, girişim STARTED ile kanıtlı).
- **Append-only DB'de zorlanır**: migration'daki `BEFORE UPDATE OR DELETE` + `BEFORE TRUNCATE` trigger'ı `RAISE EXCEPTION`. Uygulama koduna güvenilmez.
- `actorId` **FK'sız** düz uuid: kullanıcı silinse de kayıt ne silinir ne güncellenir (`SET NULL` bir UPDATE olurdu ve append-only'yi delerdi).
- **PII sınırı (net):** yazılabilir = `actorId` (uuid), hedef id'ler, rol adı, alan-düzeyi minimal değişiklik (`before`/`after`), sayaçlar. Yazılamaz = e-posta, ad,
  kullanıcı konumu/koordinatı, mekan serbest metin içeriği, CSV satır içeriği. (`actorId` yönetici personelin sözde-kimliğidir; hesap verebilirlik amacıyla
  saklanır, KVKK silme talebinde gerekçeli istisna olarak belgelenir — Plan 4d'de netleştirilir.)

## Kabul edilen bedel
- **Tamper-evident değil:** DB süper-kullanıcısı trigger'ı kaldırıp kaydı değiştirebilir; imza/hash zinciri yok.
- **Fail-closed:** audit yazılamıyorsa admin işlemi de başarısız olur (kullanılabilirlik pahasına hesap verebilirlik). Admin trafiği düşük olduğundan kabul.
- Her tek-kayıtlı admin yazması +1 INSERT (aynı transaction; kilit süresi marjinal artar).
- CSV audit'i atomik değil: STARTED var/IMPORTED yok durumu "yarım import"u temsil eder ve elle incelenmesi gerekir.
- Tablo sınırsız büyür; retention politikası şimdi yok.

## Erken uyarı sinyalleri (ölçüm kaynağı ve sıklığı dahil)
- **Boyut:** ayda bir `SELECT reltuples::bigint FROM pg_class WHERE relname='audit_log'` > 1.000.000 ⇒ partition/arşiv kararı aç.
- **Gecikme:** B2 PR'ında admin yazma uçları için baseline p95 ölçülür (e2e zamanlama betiği; sonuç PR açıklamasında). Sonraki her çeyrekte aynı betik
  baseline'ın +25 ms üstüne çıkarsa ⇒ yazım yolunu gözden geçir.
- **Yarım import:** haftalık `SELECT count(*) FROM audit_log s WHERE action='CSV_IMPORT_STARTED' AND NOT EXISTS (eşleşen CSV_IMPORTED aynı actor, sonraki 1 saat)`
  > 0 ise incele (STARTED/IMPORTED eşleşme oranı < %100 ⇒ import akışı sessizce yarım kalıyor).
- **Rol/yetki (Plan 4e):** prod DB rolü `audit_log` üzerinde INSERT+SELECT'e indirilir (trigger'a ek katman). Bu bir *eylem maddesi*, ADR varsayımı ihlali değildir;
  yapılmadan canlıya çıkılmaz.
- **Tetik (post-hoc):** ilk gerçek güvenlik soruşturmasında kaydın cevaplayamadığı bir soru çıkarsa (örn. "kim sildi") ⇒ imzalı/harici (append-only obje deposu)
  sürüme geçiş ADR'si açılır. Bu erken uyarı değil, gerçekleşmiş başarısızlığın işaretidir; bilerek ayrı tutuldu.

## Sonuç (sonradan doldurulur)
Tarih: — · Tuttu mu: — · Ne öğrendik: —
