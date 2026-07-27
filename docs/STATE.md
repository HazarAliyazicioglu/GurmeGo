# Durum — 2026-07-28

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7, Plan 4a ✅ 3/3, Plan 4b ✅ 16/16, Plan 4c ✅ 16/16
+ final whole-branch review TEMİZ. **Ardından: Plan 1-4c'nin TAMAMI (kullanıcı talebiyle) 3 pakette
(apps/api, apps/web, apps/admin) tam-kod full-codebase Codex review'dan geçirildi, bulunan HER
bulgu (BLOCKER→MAJOR→MINOR) Task 17-25 olarak düzeltildi ve her fix bağımsız Codex re-review'dan
TEMİZ geçti — TAMAMLANDI.** `master`'a hiçbir plan henüz merge edilmedi (kullanıcı kararı: hepsi
bitince tek seferde).

## Şu an ne yapıyoruz
Kullanıcı "Plan 1'den 4c'ye kadar HER ŞEY'i teste ve review'a sok" dedi (2026-07-26/27/28 arası).
Üç paketin tam kodu Codex'e review ettirildi: apps/api (0 BLOCKER, çok sayıda MAJOR), apps/web
(0 BLOCKER, 5 MAJOR), apps/admin (1 BLOCKER — JWT rol-case uyuşmazlığı, 2 MAJOR). Kullanıcı
"büyükten küçüğe her türlü sorunu çöz, düzelttiğini tekrar review ve testten geçir" dedi. Sonuç,
Task 17-25 olarak subagent-driven-development disipliniyle yürütüldü:
- Task 17: BLOCKER (JWT rol-case, apps/api+apps/admin) — TEMİZ.
- Task 18-19: apps/api MAJOR (race condition'lar, pagination, security/ops) — TEMİZ (1 non-blocking MINOR).
- Task 20: apps/api mimari kural ihlalleri (raw SQL relocation, rule-engine eşikleri) — 1 fix turu (test kalitesi MINOR'ları), TEMİZ.
- Task 21: apps/api MINOR küme (7 bulgu: any, validasyon, csv-import, rate-limit cleanup) — TEMİZ ilk turda.
- Task 22: apps/web MAJOR küme (pagination, 404 conflation, **favoriler sayfası session-değişimi privacy bug'ı**) — 3 fix turu gerektirdi (ilk fix'te 2 BLOCKER çıktı — privacy leak render-timing'de hâlâ vardı + create-list guard'sız; sonra 2 test'in gerçekte ayırt edici olmadığı bulundu, güçlendirildi; sonra o testlerin kapsamı dar bulunup genişletildi) — TEMİZ.
- Task 23: apps/web MINOR küme (favorite-button race, googleRating=0 falsy-hide) — TEMİZ (1 kozmetik MINOR test-yorumu düzeltmesi ile).
- Task 24: apps/admin MAJOR küme (kuyruk sayfası refetch race, 401/403 mesaj ayrımı) — 1 fix turu (AuthProvider referans stabilizasyonu MINOR'ı), TEMİZ.
- Task 25: apps/admin MINOR (erisim-yok sayfasına çıkış butonu) — TEMİZ.

Tüm task'larda pattern: implementer (sonnet) → code-reviewer (Codex-yönlendirmeli) → bulgu varsa fix
subagent'ı → re-review, TEMİZ oluncaya kadar. Bir review turunda reviewer'ın Codex'e delege ETMEDİĞİ
(kendi başına Sonnet olarak review yaptığı) fark edildi — aynı commit gerçek Codex-yönlendirmeli
review'a tekrar sokuldu, TEMİZ doğrulandı. **Ders: her review raporunda Codex'in gerçekten
çağrıldığını teyit et, rapor formatına güvenme.**

## Sıradaki adım
Kullanıcıya Task 17-25'in tamamlandığını bildir. İki seçenek: (a) tüm bu ek fix'leri de kapsayan
YENİ bir final whole-branch review (Plan 4c'nin merge-base'inden şu ana kadarki tüm commit'ler) —
opsiyonel ama tutarlılık için önerilir; (b) doğrudan kullanıcıya "her şey test edildi + review
edildi" özeti verip master'a merge kararını sor. Merge kararı kullanıcıya ait.

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
