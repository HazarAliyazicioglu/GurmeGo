# Durum — 2026-07-26

## Aktif plan
Plan 1 ✅ 24/24, Plan 2 ✅ 12/12, Plan 3 ✅ 7/7, Plan 4a ✅ 3/3, Plan 4b ✅ 16/16 (final review
TEMİZ). **Plan 4c (frontend/admin düzeltmeleri, 16 task) planı HAZIR** — 10 plan-red-team turu
sonunda (Codex, `docs/superpowers/plans/2026-07-26-frontend-fixes.md`). Şimdi
`subagent-driven-development` ile yürütülüyor. `master`'a hiçbir plan henüz merge edilmedi
(kullanıcı kararı: hepsi bitince tek seferde).

## Şu an ne yapıyoruz
Plan 4c'nin implementasyon planı 10 round gerektirdi (Plan 4b'nin 6 rounduna göre daha zorlu) —
round 1-2 klasik task-sözleşme çakışmaları, round 3-4 planın gerçek dosyalara değil hayali
arayüzlere göre yazıldığının keşfi (ground-truth pass + tekrar doğrulama), round 5 en ciddi bulgu:
üç task'lık bir bölüm (C1/C11/C12 hata yönetimi) yeniden numaralandırma sırasında sessizce
plandan düştü — C1-C14 madde→task çapraz-referans tablosu bu sınıf hatayı bir daha önlemek için
eklendi. Round 6-10 giderek küçülen yerel düzeltmeler (imkânsız test geçişleri, eksik fixture
alanları, design doc/plan uyumsuzlukları). Round 10 HAZIR dedi. Şimdi Task 1'den başlayarak
subagent-driven-development ile yürütme aşamasındayız.

## Sıradaki adım
Plan 4c'yi task-brief + implementer subagent + task-reviewer döngüsüyle Task 1'den başlayarak
yürüt; `.superpowers/sdd/progress.md`'ye ilerlemeyi kaydet; tüm 16 task bitince final whole-branch
review (Codex-yönlü `code-reviewer`).

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1/2/3 red-team + Pilot Karar Sözleşmesi: docs/CHANGELOG.md, prd.md §1+§5. Plan 1-4b
  mimari kararları/red-team kayıtları: docs/adr/001-003, ilgili plan/spec dosyaları.
- Plan 4c'nin C5 kapsam daraltması (switcher yerine mevcut all-lists-grid): design doc'un kendisine
  işlendi (docs/superpowers/specs/2026-07-26-frontend-fixes-design.md §7).

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search, geniş kullanıcı katkısı (MVP'de): ELENDİ → Faz 2. KALICI.
- React Native (MVP'de), Gurme Puanı/yorum (MVP'de), landing page ön-testi: ELENDİ (round 3 kararları).
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Plan 4c planı 10 tur gerektirdi (Plan 4b'nin
  6'sından daha fazla). KALICI ders: Codex gerçekten TEMİZ/HAZIR diyene kadar kesme.
- `codex exec`'e büyük diff'i (>150KB) argüman olarak verme: ELENDİ. KALICI çözüm: stdin'den pipe et.
- Bir sözleşme değişikliğini tüketicisinden farklı task'a koymak: ELENDİ (Plan 4b 3 kez, Plan 4c'de
  de tekrar tekrar — Task 4→9 sınırında, sonra Task 4 içinde bile). KALICI: "bunu kim üretiyor, aynı
  task'ta mı?" + KOŞULLU yeni ders: bir plan rewrite sırasında TASK NUMARALARI değişirse, her C/gereksinim
  maddesinin hâlâ bir task'a atandığını gösteren açık bir çapraz-referans tablosu tutulmalı — aksi
  halde bir bölüm sessizce kaybolabilir (Plan 4c round 5'te oldu).
- Bir "ground-truth pass" (Explore agent ile gerçek dosya okuma) tek seferde her şeyi doğru
  yakalar varsaymak: ELENDİ (Plan 4c round 3→4) — bir sonraki red-team turu bile aynı dosyaları
  tekrar grep'leyip pass'in kendisinin bazı satırları (örn. serializeFilters'ın lat/lng ürettiği)
  kaçırdığını buldu. KALICI ders: plan rewrite'ından hemen önce şüpheli her iddiayı `grep`/`Read`
  ile TEKRAR doğrula, önceki bir pass'in raporuna güvenme.
