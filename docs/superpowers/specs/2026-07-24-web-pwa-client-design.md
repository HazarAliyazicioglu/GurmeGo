# GurmeGo Web/PWA Client — Design (Plan 2/4)

**Tarih:** 2026-07-24 · **Durum:** Onaylı (kullanıcının açık otonomi talimatı gereği, mevcut onaylı
spec'lerden — prd.md, architecture.md, product-overview.md, api-spec.md — sentezlendi; ayrıca soru
sorulmadı, bkz. STATE.md "kullanıcı kararları")

## Amaç

Plan 1'de tamamlanan backend API'yi (`apps/api`, `/v1` altında) tüketen tek bir web/PWA istemcisi.
Pilot Karar Sözleşmesi'nin (prd.md §5) MVP'si: web/PWA-only, editör-only öneri (Gurme Puanı yok),
30-45 mekan, 3 ilçe. Bu, gerçek kullanıcıların dokunacağı ilk arayüz — pilotun doğrulama aracı bizzat bu.

## Kapsam (prd.md/api-spec.md'den, yeni karar değil — mevcut spec'in uygulanması)

**Sayfalar:**
1. **Keşif** (`/` veya `/[ilce]`) — ilçe seçimi (FR-KA-01), liste↔harita toggle (FR-KA-02), filtreler
   (kategori/fiyat/açık-kapalı/mesafe/butik — FR-KA-03), kategori bazlı hızlı rota (FR-KA-06).
2. **Mekan Detay** (`/mekan/[slug]`) — fiyat aralığı, favori ürünler, ulaşım notu, saatler, imzalı
   editöryal not, Google puanı özet rozeti + deep-link (FR-MD-05), yol tarifi deep-link (FR-MD-03),
   WhatsApp paylaşım (FR-MD-06), "bilgi yanlış" bildirim formu (kimliksiz, `POST /venues/:id/report`).
3. **Favoriler** (`/favoriler`) — liste görüntüleme + mekan ekleme; giriş gerektirir (AK-02 seçenek a:
   anonim gezinme, favori için hesap).
4. **Giriş/Kayıt** (`/giris`) — Supabase Auth (e-posta) — yalnızca favoriler için gerekli, keşif/detay
   tamamen kimliksiz çalışır.

**Kapsam dışı (Faz 2, prd.md'de zaten karar bağlanmış):** yorum/puanlama, Gurme Puanı, kullanıcı
katkısı (yeni mekan/düzeltme önerisi — yalnızca genel "bilgi yanlış" bildirimi MVP'de var), doğal dil
arama, React Native.

## Mimari

- **Next.js 14 (App Router)** — architecture.md'nin kararı. Keşif ve mekan detay sayfaları SSR/SSG
  (SEO — organik keşif kanalı, product-overview.md §5); favoriler/giriş CSR (kişiselleştirilmiş,
  SEO'ya gerek yok).
- **PWA:** manifest.json + service worker (round 3 panel kararı — mobil native yerine). Offline-first
  değil, yalnızca "ana ekrana ekle" + temel önbellekleme.
- **API tüketimi:** `packages/api-client` (Plan 1 Task 21'de üretildi) — tipli fetch wrapper. Yanıt
  gövdeleri şu an gevşek tipli (openapi.json'da DTO şeması yok, bilinen sınırlama) — `packages/shared`'ın
  zod şemalarıyla (`VenueSchema` vb.) istemci tarafında doğrulanacak, boşluğu kapatan katman bu olacak.
- **Auth:** Supabase Auth JS client (browser SDK), session cookie/localStorage — backend zaten JWT+JWKS
  doğruluyor (Plan 1 Task 10), bu istemci yalnızca giriş akışını sağlayıp token'ı `Authorization` header
  olarak `api-client`'a geçirecek.
- **Stil:** Tailwind CSS + `ui-ux-pro-max`/`impeccable` skill referansı (SKILLS.md'de zaten evrensel
  taban olarak kayıtlı). **Görsel/tasarım yargısı gerektiren task'lar** (`delegating-ui-work` üzerinden
  Codex'e) — CLAUDE.md kuralı gereği, Sol arayüzü render edip değerlendirebiliyor, Claude göremiyor.
  Sayfa mantığı/state/API entegrasyonu Claude subagent'larıyla (bu planın geri kalanıyla aynı
  `subagent-driven-development` akışı), CSS/layout/görsel iterasyon Codex'e delege edilecek.
- **Harita:** Sorun 7 çözümü (RISK-MITIGATION.md) — mekan detayında gömülü mini-harita (statik önizleme,
  etkileşimli SDK maliyeti MVP'de gereksiz) + "Yol Tarifi Başlat" deep-link.

## Veri akışı

Keşif sayfası → `GET /v1/venues` (liste) veya `GET /v1/venues/map?bbox=` (harita) → `packages/shared`
zod ile doğrula → render. Mekan detay → `GET /v1/venues/:slug` (SSG/ISR, build-time veya kısa revalidate
— pilot ölçeğinde 30-45 mekan, sık build sorun değil). Favoriler → Supabase Auth token ile
`GET/POST /v1/me/lists` (kimlik doğrulama gerekli, aksi halde 403 — Plan 1'de bu davranış zaten
doğrulandı).

## Test stratejisi

`development-guidelines.md §4`'ün "Smoke E2E" kararı: Playwright ile keşif→detay→favori,
mekan paylaş (WhatsApp), bilgi-yanlış bildir — 4-5 senaryo. Bileşen bazlı birim test yok (backend'in
aksine, bu bir UI katmanı — mantık backend'de, burada mantık minimal).

## Self-review

- Placeholder/TBD yok.
- İç tutarlılık: AK-02 (a) seçeneği zaten prd.md'de API tasarımının varsayılanı olarak seçilmişti —
  burada yeniden açılmıyor, sadece uygulanıyor.
- Kapsam: tek bir alt-sistem (web istemcisi), bağımsız plana uygun büyüklükte.
- Belirsizlik: yok — her karar mevcut onaylı dokümana referans veriyor.
