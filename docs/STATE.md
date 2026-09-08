# Durum — 2026-09-08

## Kod artık `master`'da
Web/PWA MVP (Plan 1-4c) 2026-09-06'da merge edildi. Bu tarihte, kullanıcının pivot kararıyla
(bkz. ADR 005) inşa edilen **native mobile MVP** (`apps/mobile`, Expo/React Native, Plan
2026-09-07-mobile-mvp, 17 task) de `master`'a merge edildi — subagent-driven-development ile
`.claude/worktrees/mobile-mvp` worktree'sinde yürütüldü, worktree ve branch temizlendi.

## Aktif plan
Mobile MVP: 17/17 task ✅, final whole-branch review (Codex) BLOKE → 5 gerçek bulgu (2 BLOCKER: Expo
env inlining kırıktı + FavoritesScreen cross-user session leak; 3 MAJOR: Discovery/Favorites race
guard'ları yok, filtre chip'leri hiç kaldırılamıyordu, VenueDetail'de 4 alan eksikti) tek fix
dalgasında düzeltildi, scoped re-review TEMİZ. Tam ayrıntı: git log `31284f8` civarı,
commit mesajları + PR'sız lokal merge geçmişi.

## Şu an ne yapıyoruz
Mobile MVP merge tamamlandı. Sıradaki: Plan 4d (KVKK+event-capture+hesap silme) ve Plan 4e (gerçek
provisioning+EAS Build/Submit+auth-sync+go-live runbook, artık mobile app'in gerçek store'lara
çıkışını da kapsıyor) — ikisi de tasarım taslağı hâlinde, henüz `idea-red-team`'den geçmedi.

## Sıradaki adım
Kullanıcıya Plan 4d'nin 4 açık sorusunu ve Plan 4e'nin 3 açık sorusunu (artık EAS/store hesapları
dahil) sor, sonra ikisini de `idea-red-team`'den geçir.

## Bloke olanlar
- Yok.

## Yakın kararlar
- ADR 005: native mobile pivot (web/PWA'dan native app'e dönüş), `idea-red-team` NO-GO verdiğine
  rağmen kullanıcı "gözler açık" onayladı — bkz. docs/adr/005, design doc §0/§8.
- Mobile Discovery'de web'in bbox çoklu-mekan haritası (venue-map-leaflet.tsx) taşınmadı — bilinçli
  kabul edilmiş kapsam kararı (SDD ledger Ruling 1, artık silindi ama plan dosyasında kayıtlı).
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi (web/PWA dönemi): docs/CHANGELOG.md, prd.md §1+§5.
- Plan 1 mimari kararları: docs/adr/001-004.

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Tam menü/semantic search/geniş kullanıcı katkısı/Gurme Puanı (MVP'de): Faz 2'ye.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Codex TEMİZ diyene kadar kesme (Task 27: 11
  tur; mobile plan final review'ı: 1 fix dalgası + scoped re-review yeterliydi ama TEMİZ'e kadar
  kesilmedi).
- Cross-session/cross-user guard'larda TEK bir sinyal (token VEYA identity) kullanmak: ELENDİ —
  aynı bug class mobile'da FavoritesScreen'de tekrar bulundu (final review), monotonic
  request-counter pattern (FavoriteButton'daki gibi) her yeni ekran/hook'ta BAŞTAN uygulanmalı,
  "web'de zaten çözüldü" varsayımıyla atlanamaz.
- Expo `EXPO_PUBLIC_*` env değişkenlerini `process.env[name]` gibi dinamik erişimle okumak: ELENDİ
  — Metro yalnızca literal `process.env.EXPO_PUBLIC_X` ifadelerini statik inline eder; dinamik
  erişim gerçek cihaz build'inde sessizce undefined döner. Jest bunu yakalamaz (Metro kullanmaz).
