# Durum — 2026-09-25

## Veri sınırı
Codex: izinli, GLM: izinli (kişisel proje). Kaynak: 2026-09-08.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23, pekiştirildi):** A-Z yetki verildi, kapanış sorusu bile sormadan sıradaki işe geç. Yalnız gerçek Supabase/production erişimi gerektiren geri dönüşsüz adımlarda durulur.

## Şu an ne yapıyoruz
**REVIEW-PLAN.md temizliği + kalan bulguların kapatılması (2026-09-25).** İki commit:
- `7f3c003` — web+admin `error.tsx`/`not-found.tsx` (dünden yarım kalmış, cross-model-review yapıldı: 1 MAJOR reddedildi — Next.js `reset()` zaten Server Component segmentini yeniden fetch ediyor, "sonuçsuz kalır" iddiası dokümantasyona aykırı)
- `fb460e2` — geniş bir fork denetimiyle REVIEW-PLAN.md'nin güncel olmadığı görüldü (§2.1 web cache revalidate, §4.1 sign-out, §4.5 mobile Error Boundary, §4.2 mobile pagination fark edilmeden zaten çözülmüştü). **Artık 6/6 KRİTİK bulgu çözülmüş durumda.** Ayrıca gerçekten açık olan küçük maddeler kapatıldı: mobile AuthScreen double-submit guard, TabNavigator tabBarIcon (geçici glyph), ReportForm client validasyonu (backend şemasını reuse ediyor), admin erisim-yok sayfası stili, web manifest.json theme_color senkronu. Cross-model-review: 0 BLOCKER/0 MAJOR/2 MINOR, ikisi de düzeltildi.

## Sıradaki adım
**Web'de serbest metin arama eksikliği** (`venue-filters.tsx`'te arama input'u/parametresi hiç yok) — orta-büyük boyutlu, gerçek bir ürün deneyimi eksikliği, ayrı bir brainstorming/plan gerektirir (backend arama desteği var mı önce kontrol edilmeli). Bunun dışında CSP eksikliği (web+admin `next.config.js`, bilinçli ertelenmiş, Leaflet/Supabase allow-list gerektiriyor) orta öncelikli bekliyor. Agent-yapılabilir gerçek blocker yok, kullanıcı tarafı: Supabase/Railway/Vercel/domain.

## Bloke olanlar
- Yok (agent tarafı). Kullanıcıya ait: gerçek Supabase/Railway/Vercel hesapları + domain. Mobile crash reporting SDK'sı (Sentry) da bir hesap gerektirdiği için Faz 2'ye bilinçli ertelendi (`ErrorBoundary.tsx` içinde belgeli).

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Review/red-team'i tek turda bitirmeyi ummak · CI "yazıldı=çalışıyor" varsayımı · Codex çıktısını görmeden "çalışıyor" saymak: ELENDİ, KALICI.
- Majör bağımlılık yükseltmesini "testler yeşil" ile kapatmak: ELENDİ, KALICI.
- `turbo.json`'da paket-özel `dependsOn` ile test task'larını zincirlemek: ELENDİ, KALICI.
- Global turbo `--concurrency=2` ile test flake'ini çözmeye çalışmak: ELENDİ, KALICI.
- Bellek baskısı altında arka plan `codex exec` komutunu ısrarla tekrar tekrar denemek: ELENDİ, KALICI — sistem otomatik `killed` ediyor; ama bellek biraz boşaltılınca (2.4GB→5.4GB) `codex exec` başarıyla çalıştı, sorun tamamen çözülemez değilmiş.
- React Native testing-library'de `fireEvent.press`'i art arda `await`'siz çağırmak "overlapping act() calls" uyarısı üretiyor — testleri hâlâ geçiyor (kozmetik), tek bir `act(async () => {...})` bloğuna sarmak kısmen azaltıyor ama tam gidermiyor. KOŞULLU — RTL sürümü değişirse tekrar bakılabilir.
- REVIEW-PLAN.md'deki "UYGULANMADI" etiketleri zamanla stale kalabiliyor (kod ilerlerken doküman güncellenmemiş) — büyük bir denetim/plan dokümanına dönmeden önce önce mevcut kodla çapraz kontrol et, doğrudan listeye güvenme. KALICI ders.
- pino-http'de sadece bilinen alanı redact etmek: ELENDİ, KALICI.
- Test dosyasında `import Error from "./error"` gibi global tip/sınıf adını gölgeleyen bir isimle component import etmek: ELENDİ, KALICI.
- Prisma7 `$connect()` lazy güveni · Worktree'de apps/api typecheck farklı sonuç verebilir · Workspace'te birden çok `@types/react` sürümü · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
