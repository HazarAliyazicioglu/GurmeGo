# Durum — 2026-07-27

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7, Plan 4a ✅ 3/3, Plan 4b ✅ 16/16, **Plan 4c ✅ 16/16
(frontend/admin düzeltmeleri)** — hepsi task-review'dan geçti. `master`'a hiçbir plan henüz merge
edilmedi (kullanıcı kararı: hepsi bitince tek seferde). Sıradaki: Plan 4c'nin final whole-branch
review'ı (Codex-yönlü `code-reviewer`), sonra tüm planların birlikte merge kararı.

## Şu an ne yapıyoruz
Plan 4c'nin implementasyon planı 10 plan-red-team turu gerektirmişti (round 5'te bir görevin
sessizce plandan düşmesi dahil — C1-C14 çapraz-referans tablosu bu sınıf hatayı önlemek için
eklendi). HAZIR onayından sonra `subagent-driven-development` ile 16 task sırayla yürütüldü:
Task 3 (favorite-button/auth-context/auth-form) 2 fix turu gerektirdi (gerçek race condition +
lint regresyonu), Task 7 (venue-detail map) 1 fix turu (react-leaflet remount + zayıf test), Task
14 (boutique/openNow toggle) 1 fix turu (serializeFilters'ın kendisi hâlâ isBoutique=false
üretebiliyordu, toggle düzeltmesine rağmen). Kalan 13 task tek seferde TEMİZ geçti. Task 16 (final
regresyon) tamamlandı: apps/web 111/111, apps/admin 39/40 (1 Plan 4c'den bağımsız, önceden var
olan hata — bkz. aşağı), packages/api-client 2/2, turbo typecheck+lint 0 hata (yalnızca 2 önceden
kabul edilmiş any/unused uyarısı). C1-C14 çapraz-kontrolü: hepsi task 3-14'e atanmış, hiçbiri
kayıp/çift değil.

## Sıradaki adım
Plan 4c'nin final whole-branch review'ını çalıştır (52 commit'lik tam diff'e karşı Codex ile,
Plan 4b'nin sürecini tekrarla — round round TEMİZ'e kadar). Ardından manuel tarayıcı smoke testi
(bu otomasyon ortamında yapılamaz — gerçek Leaflet SVG odak/klavye davranışı ve district-to-district
navigasyonda map remount'u kullanıcı tarafından doğrulanmalı).

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1-10 red-team kayıtları: docs/superpowers/plans/2026-07-26-frontend-fixes.md (plan
  başındaki özet + git log), docs/SESSION-LOG-2026-07-26.md.
- Plan 4c'nin C5 kapsam daraltması (switcher yerine mevcut all-lists-grid) design doc'un kendisine
  işlendi: docs/superpowers/specs/2026-07-26-frontend-fixes-design.md §7.

## Ertelenen/izlenen maddeler
- `apps/admin/src/lib/api.spec.ts`: `getQueue` non-REPORT item'ları reddetmiyor (test zaten
  başarısız) — Plan 4c'den TAMAMEN bağımsız, pre-Plan-4c baseline'da (commit 1fc7333) da başarısız
  olduğu doğrulandı. Ayrı bir oturumda düzeltilmeli.
- `apps/web/src/app/favoriler/page.spec.tsx`'te `next/navigation` mock'u stabilize edildi (gerçek
  `useRouter()` referans-stabil olduğu için); kardeş spec dosyaları (`auth-form`, `district-picker`,
  `favorite-button`, `venue-detail`) hâlâ eski unstable-per-render mock deseninde — zararsız (o
  sayfaların effect'leri `router`'a bağımlı değil), ama biri `router`-bağımlı bir effect kazanırsa
  gözden geçirilmeli.
- `apps/web/src/components/venue-map-leaflet.tsx`: bir marker mount edildikten sonra `venue.name`
  değişirse (map remount olmadan) `aria-label` bayat kalabilir — gerçek kullanım senaryosunda
  (mekan adı canlı harita açıkken değişmiyor) pratik risk yok, test edilmemiş bir kenar durum.

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native (MVP'de), Gurme Puanı/yorum (MVP'de): ELENDİ (round 3 kararları).
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Plan 4c planı 10 tur gerektirdi. KALICI
  ders: Codex gerçekten TEMİZ/HAZIR diyene kadar kesme.
- Bir sözleşme değişikliğini tüketicisinden farklı task'a koymak: ELENDİ (Plan 4b 3 kez, Plan 4c'de
  tekrar tekrar). KALICI: her plan rewrite'ında C/gereksinim maddesi → task çapraz-referans tablosu
  tut, aksi halde bir bölüm sessizce kaybolabilir.
- Bir "ground-truth pass"in (Explore agent) tek seferde her şeyi doğru yakalayacağını varsaymak:
  ELENDİ — bir sonraki red-team turu aynı dosyaları tekrar grep'leyip pass'in kaçırdığı satırları
  buldu. KALICI ders: plan rewrite'ından hemen önce şüpheli her iddiayı tekrar `grep`/`Read` ile
  doğrula.
- Bir subagent'ın "waiting for background notification" deyip cevap vermemesi: bu ortamda gerçek
  bir arka plan sürecini beklemiyor, sadece kendi kendini yanlış modelliyor — `SendMessage` ile
  agent'ı doğrudan nazikçe "şimdi sonucu ver" diye dürtmek işe yarıyor. KALICI çözüm.
