# Durum — 2026-07-30

## Tam ayrıntı
Bu dosya 50 satır tavanlı özet. **Tam A-Z detay için `docs/SESSION-LOG-2026-07-26.md`'nin en
üstteki "ŞU AN NEREDEYİZ (2026-07-30)" bölümünü oku** — her Task 17-26'nın ne bulduğu/nasıl
düzeltildiği, Codex kota bloğunun tam hikayesi, Plan 4d/4e'nin nasıl şekillendiği, hepsi orada.

## Aktif plan
Plan 1 ✅24/24, 2 ✅12/12, 3 ✅7/7, 4a ✅3/3, 4b ✅16/16, 4c ✅16/16 — final review'lar TEMİZ.
Plan 4c sonrası: Plan 1-4c'nin TAMAMI full-codebase Codex review'dan geçirildi, bulunan her şey
Task 17-25 olarak düzeltildi (TEMİZ). Sonrasında istenen final whole-branch review (Task 17-25'in
16 commit'i) 1 BLOCKER+4 MAJOR+3 MINOR gerçek cross-task sorun buldu → Task 26 olarak düzeltildi
(5 commit, `1ecbb2e..c0e2e80`) — apps/admin ilk kez 60/60 sıfır hata. `master`'a hiçbir plan
merge edilmedi (kullanıcı kararı: hepsi bitince tek seferde).

## Şu an ne yapıyoruz
**Task 26'nın kendi review'ı Codex (ChatGPT Plus) kotası tükendiği için yapılamadı — kota
sıfırlanma 2026-08-01 23:26.** Kullanıcı beklemeyi seçti (GLM/self-review'ı reddetti). Bu
beklemede kullanıcı isteğiyle iki iş bitirildi: (1) `docs/CHANGELOG.md`'nin 2026-07-25'ten beri
boş kalan büyük boşluğu dolduruldu (Plan 4b/4c/audit/Task 17-26 kayda geçti, birkaç eski "açık
madde" iddiası kodda doğrulanıp kapatıldı işaretlendi); (2) Plan 4 (Infra/CI/KVKK/pilot) tasarım
taslağı yazıldı, kullanıcı cevaplarıyla **Plan 4d** (KVKK+event-capture+hesap silme, saf kod,
gerçek hesap gerektirmez) ve **Plan 4e**'ye (gerçek provisioning+auth-sync+go-live, kod
üretmeyen bir runbook — her hesap açma/ödeme adımında onay gerekir) bölündü.

## Sıradaki adım (yeni oturum buradan devam etsin)
1. Kota gerçekten döndü mü diye küçük bir prova ile kontrol et (2026-08-01 23:26'dan sonra).
2. Task 26'nın review'ını (`1ecbb2e..c0e2e80`) gerçek Codex ile tekrar çalıştır — TEMİZ çıkarsa
   final whole-branch review de bitmiş sayılır, kullanıcıya master merge kararını sor.
3. Kullanıcıya Plan 4d (4 açık soru) ve Plan 4e'nin (3 açık soru) kalan noktalarını sor, sonra
   ikisini de `idea-red-team`'den geçir.

## Bloke olanlar
- Task 26 review'ı + Plan 4d/4e'nin `idea-red-team`'i — ikisi de aynı Codex kotasını bekliyor
  (2026-08-01 23:26).
- Master'a merge yok (Task 26 review'ı temizlenene + kullanıcının "hepsi bitince" kararı gereği).

## Yakın kararlar
- Round 1-10 red-team kayıtları: `docs/superpowers/plans/2026-07-26-frontend-fixes.md`,
  `docs/SESSION-LOG-2026-07-26.md`.
- Plan 4d/4e tasarımları: `docs/superpowers/specs/2026-07-29-plan4d-*.md` /
  `2026-07-29-plan4e-*.md` (orijinal bölünmemiş taslak: `2026-07-29-infra-launch-design.md`,
  artık arşiv).

## Ertelenen/izlenen maddeler
- `apps/web/src/app/favoriler/page.spec.tsx`'te `next/navigation` mock'u stabilize edildi;
  kardeş spec dosyaları hâlâ eski desende — zararsız, biri `router`-bağımlı effect kazanırsa
  gözden geçirilmeli.
- `venue-map-leaflet.tsx`: marker mount sonrası `venue.name` değişirse `aria-label` bayat
  kalabilir — test edilmemiş, pratikte risksiz kenar durum.
- Plan 2 E2E kapsamı, `useGeolocation` çift-mount, Plan 3'ün zararsız çift `@UseGuards` — hiçbiri
  bu oturumda doğrulanmadı, ayrı incelemeyi hak ediyor (CHANGELOG "2026-07-26/28" girdisi).

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü, semantic search, geniş kullanıcı katkısı (MVP'de), React Native (MVP'de), Gurme
  Puanı/yorum (MVP'de): ELENDİ → Faz 2. KALICI.
- Review/red-team'i tek turda bitirmeyi ummak: ELENDİ — Codex gerçekten TEMİZ/HAZIR diyene kadar
  kesme. Aynı dosya/mantık birden fazla kez düzeltiliyorsa regresyon riski artıyor, azalmıyor.
- Bir sözleşme değişikliğini tüketicisinden farklı task'a koymak: ELENDİ (defalarca). KALICI:
  her plan rewrite'ında C/gereksinim → task çapraz-referans tablosu tut.
- Bir review raporunun "TEMİZ" demesine, Codex'in gerçekten çağrıldığını doğrulamadan güvenmek:
  ELENDİ (Task 25'te bir reviewer kendi başına Sonnet olarak review yapıp TEMİZ dedi). KALICI:
  her review'da somut kanıt (token kullanımı, session id) iste.
- Kota bittiğinde sessizce başka modele/self-review'a kaçmak: ELENDİ (global kural, Task 26'da
  test edildi — kullanıcıya durup sorma doğru seçim oldu).
