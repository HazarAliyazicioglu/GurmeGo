# Durum — 2026-07-24

## Aktif plan
`docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` — Plan 1/4 (Backend + Data Foundation).
`plan-red-team` (Codex) tamamlandı: ilk verdikt YENİDEN BÖL (kısaltılmış özet üzerinden), gerçek
bulgular (eksik PUT endpoint, /v1 prefix, Retry-After header, tekrarlanan eşik sabiti, ADR hataları)
plana işlendi, genel "YENİDEN BÖL" verdikti gerekçeyle reddedildi (bkz. planın "Red-team bulguları"
bölümü). ADR 001/002/003 yazıldı (`docs/adr/`). Henüz yürütülmedi. 0/24 task.
Yol haritası: 1) Backend+Data (bu plan) → 2) Web/PWA client → 3) Admin panel UI → 4) Infra/CI/KVKK/pilot.

**Teknik not:** Codex CLI sandbox'ı proje dizini dışındaki dosyaları (ör. AppData\Temp) okuyamıyor gibi
görünüyor — süresiz takılıp zaman aşımına uğruyor; önce proje içine kopyalanmalı.

## Şu an ne yapıyoruz
8 perspektifli panel + Codex round 3 red-team **KOŞULLU-GO** verdi (Pilot Karar Sözleşmesi: 30-45 mekan,
6 hafta, ≥150 kullanıcı — prd.md §5). Kullanıcı "önce landing page testi" önerisini reddedip
"minimal-ama-gerçek ürünle doğrula" yaklaşımını seçti. Tüm docs/*.md round 3 kapsamıyla (web/PWA-only,
Gurme Puanı/yorum/RN → Faz 2) tutarlı hale getirildi. Plan 1 yazıldı ve red-team'den geçirildi.

## Kullanıcı kararları (2026-07-24)
- Doğrulama: ayrı ön-test yok, minimal-ama-gerçek web/PWA pilotla gerçek kullanımla doğrulanacak.
- Mekan sahibi itiraz akışı (panelin tek anlaşmazlığı): karar pilot SONRASINA ertelendi.
- KVKK metinleri: sistem şekillendikten sonra, gerçek veri toplanmadan hemen önce yazılacak.

## Sıradaki adım
Kullanıcıya Plan 1'in red-team sonucunu + CONFIDENCE bloğunu sun, yürütme onayı iste
(`subagent-driven-development` veya `executing-plans`).

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2 red-team + çözüm envanteri: docs/CHANGELOG.md, docs/RISK-MITIGATION.md
- Round 3 panel + red-team (KOŞULLU-GO) + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5
- Plan 1 mimari kararları: docs/adr/001-003, plan-red-team bulguları planın kendi içinde

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search/pgvector, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- "Butik" tanımı salt DB kuralı: ELENDİ, hâlâ tam ölçülebilir değil — kaynak-linki önerildi (Sorun 3).
- React Native mobil (MVP'de): ELENDİ (round 3) → web/PWA ile pilot. KOŞULLU — retention kanıtlanırsa aç.
- Gurme Puanı/yorum-puanlama (MVP'de): ELENDİ (round 3, 4 ajan+Codex mutabakatı). KALICI, Faz 2'ye kadar.
- Landing page ön-testi: ELENDİ (kullanıcı kararı). KOŞULLU — pilot sonrası Codex'in eşikleri uygulanacak.
