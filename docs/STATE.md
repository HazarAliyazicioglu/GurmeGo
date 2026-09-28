# Durum — 2026-09-28 (8. tur)

## Veri sınırı
Codex: izinli, kota geri geldi (bugün doğrulandı). GLM: izinli. Kaynak: 2026-09-08 + bugünkü kota testi.

## Ürün vizyonu
Hedef: yerli gurme+turist+genç+"semte gidince ne yesem" arayan herkes. Ölçek: SADECE İstanbul. Detay: REVIEW-PLAN.md.

## Aktif plan
**Yetki (2026-09-22/23/25/28, pekiştirildi):** A-Z yetki, kapanış sorusu bile sormadan sıradaki işe geç. Gerçek prod erişimi/gerçek veri gerektiren adımlarda kullanıcı hâlâ kendisi yapıyor.

## Şu an ne yapıyoruz
**PR #50 (2026-09-28): mobil custom-scheme deep linking (`gurmego://mekan/:slug`) shipped, CI yeşil, merge edildi.**
- React Navigation `linking` config, `RootNavigator`'a bağlı. `mekan/:slug` → VenueDetail, `kesfet`/`favoriler` → Tabs, `giris` → Auth — web'in `/mekan/[slug]` yapısıyla birebir.
- Cross-model review (Codex) bir MAJOR buldu: `initialRouteName: "Tabs"` eksikti, deep-link'le soğuk açılışta VenueDetail tek stack entry kalıyor, geri gidilemiyordu — düzeltildi. Test `getStateFromPath` ile (cihaz gerektirmiyor).
- **Universal/App Links kasıtlı kapsam dışı bırakıldı:** `https://gurme-go-web.vercel.app/...` linkinin OS seviyesinde app'i açması gerçek Apple Team ID + Android signing cert fingerprint gerektiriyor — bunlar EAS build/Apple Developer kaydı olmadan yok. Sahte `apple-app-site-association`/`assetlinks.json` yazmadım.
- Custom scheme'in gerçek cihazda açılması test edilmedi (bu ortamda simülatör/cihaz yok) — PR'da açıkça not düşüldü.

## Sıradaki adım
**Kalan üçü hâlâ kullanıcı kararı/girdisi gerektiriyor, aynen geçen turdan:**
1. Mobil tasarım sistemi (büyük, ayrı bir iş — tasarım yönü belirlenmeli).
2. Gurme Puanı / semantic search — Faz 2 kapsamını açmak kullanıcı kararı.
3. Gerçek mekan verisi (seed placeholder'ların yerine) — kullanıcının kendi verisi gerekiyor.

Sıradaki oturumda kullanıcıya bu üçünü hatırlat. Kod tabanında bunlardan bağımsız düşük riskli iş ararsam önce backend/web/admin'i tekrar tara.

## Bloke olanlar
- Universal/App Links: EAS build + Apple Developer hesabı olmadan tamamlanamaz (yukarıya bkz).
- `apps/mobile/src/lib/api.ts:58` — slug URL'e encode edilmeden interpolе ediliyor (pre-existing, PR #50 review'ında bulundu, kapsam dışı bırakıldı). Küçük, acil değil, bir sonraki mekanik/temizlik turunda al.
- CSP header, maskable icon, root OG görseli — tarayıcı/tasarım doğrulaması gerektiriyor.
- Seed placeholder verisi gerçek mekan verisiyle değiştirilmeli (kullanıcı kararı bekliyor, acil değil).
- Mobil tasarım sistemi — kullanıcıyla kapsam konuşulmadan başlanmayacak.
- PR #18/#24 (dependency upgrades): 2026-09-28 haftalık kontrolde hâlâ NO-GO — fastify plugin'leri güncellenmemiş, zod v4 `.partial()` fix'i yok.

## Yakın kararlar
- ADR 006: DB-trigger'lı append-only audit log → docs/adr/006-audit-log-append-only-table.md
- ADR 005 native mobile · Plan 1: docs/adr/001-004 · Round 1-3 red-team: docs/CHANGELOG.md, prd.md §1+§5.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- **Railway + pnpm monorepo + Railpack (otomatik tespit): ELENDİ, KALICI.** Kendi Dockerfile'ını yaz, repo kökünde, otomatik tespite güvenme.
- Railway "Generate Domain" sonrası `*.railway.internal` PUBLIC değil — public domain/Target Port ayrıca gerekir.
- Supabase direct connection çoğu ağda IPv6-only — Session/Transaction pooler'a (IPv4) geç.
- Tam menü/semantic search (MVP'de): Faz 2. KOŞULLU.
- Codex "tokens used" satırını otomatik geçerli saymak: ELENDİ, KALICI — kota hatası da bu satırla bitebiliyor.
- React Navigation linking config'de `initialRouteName` unutmak: deep-link'te geri navigasyonu kırar. KALICI — her yeni linking screen eklerken kontrol et.
- REVIEW-PLAN.md "UYGULANMADI" etiketleri stale kalabiliyor — kodla çapraz kontrol et. KALICI.
- pino-http redact · component import gölgeleme · Prisma7 `$connect()` lazy güveni · zod v4 `.partial()` default enjeksiyonu · JS `/i` Türkçe "İ" eşleşmiyor: hepsi ELENDİ, KALICI.
