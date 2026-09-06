# GurmeGo — Oturum Günlüğü (2026-07-26 ve sonrası)

**Amaç:** Bu doküman, oturumun tamamını (ne yapıldı, nerede kalındı, sırada ne var) tek yerde
tutar — `docs/STATE.md` 50 satır tavanlı bir özet olduğu için burada tam ayrıntı var. Kullanıcı
talebi (2026-07-26): "her adımdan sonra bu dokümanı güncelle, sorun çıksa da çıkmasa da". Bu
dosya her anlamlı adımdan sonra güncellenir — en yeni durum en üstte "ŞU AN NEREDEYİZ" bölümünde.

---

## ŞU AN NEREDEYİZ (en son güncelleme: 2026-07-30 — Codex kotası bekleniyor, iki plan taslağı hazır)

**Branch:** `worktree-mvp-backend-foundation` (worktree: `.claude/worktrees/mvp-backend-foundation`).
`master`'a HİÇBİR ŞEY merge edilmedi — kullanıcı kararı, hepsi bitince tek seferde.

**Tamamlanan planlar:** Plan 1 (24/24), Plan 2 (12/12), Plan 3 (7/7), Plan 4a (3/3), Plan 4b
(16/16), Plan 4c (16/16) — hepsi final whole-branch review + zorunlu Codex cross-model-review'dan
TEMİZ geçti. Ayrıntı: bu dosyanın altındaki ilgili bölümler (kronolojik sırayla).

**Plan 4c'den SONRA, henüz merge edilmemiş branch üzerinde ek bir "post-merge sertleştirme" turu
yapıldı (Task 17-26, 2026-07-26/30 arası) — bu bölüm o turun TAM özeti:**

Kullanıcı isteği (2026-07-26): "Plan 1'den 4c'ye kadar HER ŞEY'i (apps/api, apps/web, apps/admin)
teste ve review'a sok, detaylı ve parça parça." Üç paketin TAM kaynak kodu ayrı ayrı Codex'e
(`codex exec`, tam kaynak inline verilerek) full-codebase review ettirildi:
- apps/api: 0 BLOCKER, çok sayıda MAJOR/MINOR.
- apps/web: 0 BLOCKER, 5 MAJOR.
- apps/admin: **1 BLOCKER** (JWT `user_role` claim case uyuşmazlığı — DB'de uppercase enum,
  guard'larda lowercase karşılaştırma; production'da hiç fark edilmemiş çünkü gerçek Supabase
  custom access token hook henüz kurulu değil), 2 MAJOR.

Kullanıcı: "büyükten küçüğe her türlü sorunu çöz, düzelttiğini tekrar review ve testten geçir."
Bulgular severity sırasıyla Task 17-25 olarak `subagent-driven-development` disipliniyle
(implementer sonnet → code-reviewer Codex-yönlendirmeli → bulgu varsa fix → re-review, TEMİZ
oluncaya kadar) yürütüldü:

| Task | Konu | Sonuç |
|---|---|---|
| 17 | BLOCKER: JWT rol-case (apps/api `jwt-auth.guard.ts` + apps/admin `auth-context.tsx`) | TEMİZ, ilk turda |
| 18 | apps/api MAJOR: keyset pagination cursor, openNow gece-yarısı sarması, 3 race condition (row-lock/conditional updateMany), 404 dönüşümleri, reports venue-existence kontrolü | TEMİZ (1 non-blocking MINOR) |
| 19 | apps/api MAJOR: rate-limit env validasyonu, Fastify trustProxy, bbox alan/satır tavanı, admin-queue pagination limiti, JWKS_URL requireEnv güvenliği | TEMİZ, ilk turda |
| 20 | apps/api mimari: raw SQL `postgres-cache-store.service.ts`'ten `rate-limit-counters.repository.ts`'e taşındı (ADR 002), rule-engine eşikleri (`rule-config.ts`) tek zorunlu kaynağa toplandı, hardcoded fallback yok | 1 fix turu (4 test-kalitesi MINOR'ı — vestigial env atamaları, zayıf assertion'lar), sonra TEMİZ |
| 21 | apps/api MINOR küme (7 bulgu: `any` kaldırma, admin-export format validasyonu, favorites venueId UUID validasyonu, csv-import off-by-one + async parsing, rate_limit_counters temizlik cron'u, yanıltıcı queue-sort yorumu) | TEMİZ, ilk turda |
| 22 | apps/web MAJOR: SSR pagination metadata akışı, `getVenueBySlug` 404-vs-diğer-hata ayrımı (`ApiHttpError`), **favoriler sayfası session-değişimi privacy bug'ı** | **3 fix turu** — round 1 fix'inde reviewer 2 YENİ BLOCKER buldu (privacy leak render-timing'de hâlâ vardı: `useEffect` tabanlı temizlik commit'ten SONRA çalışıyordu, tek bir committed frame User A'nın verisini User B'nin oturumunda gösterebiliyordu; create-list yanıtı guard'sızdı); round 2'de 2 testin bu class of bug'ı GERÇEKTEN ayırt etmediği bulundu (reviewer fix'i geçici geri alıp testin yine geçtiğini kanıtladı) → Profiler-tabanlı commit-probe testiyle güçlendirildi; round 3'te o genişletilmiş testlerin de dar kapsamlı olduğu bulundu (yalnızca TEK senaryo kanıtlıyordu, "hiçbir zaman" gibi genel iddiayı değil) → daha da genişletildi. TEMİZ. |
| 23 | apps/web MINOR: `favorite-button.tsx` pending state'i request-generation counter ile korundu (mevcut click-guard'dan BİLİNÇLİ ayrı tutuldu), `venue-detail.tsx`'in `googleRating` falsy-check'i `!= null`'a çevrildi (0 geçerli bir puan) | TEMİZ (1 kozmetik test-yorumu MINOR'ı ile) |
| 24 | apps/admin MAJOR: `kuyruk/page.tsx` refetch race'i request-counter ile kapatıldı, 401→signOut+redirect vs 403→izin-mesajı ayrımı eklendi | 1 fix turu (`AuthProvider`'ın `value`/`signOut` referansının `useMemo`/`useCallback` ile stabilize edilmesi — MINOR, sonsuz döngü değildi ama gereksiz ekstra refetch riski), TEMİZ |
| 25 | apps/admin MINOR: `erisim-yok` (403) sayfasına çıkış butonu eklendi | TEMİZ, ilk turda |

**Önemli metodolojik olay:** Task 25'in review'ında reviewer'ın Codex'e delege ETMEDİĞİ (kendi
başına Sonnet olarak review yapıp "TEMİZ" dediği) fark edildi — kendi raporunda dürüstçe itiraf
etti. Aynı commit gerçek Codex-yönlendirmeli review'a tekrar sokuldu, TEMİZ doğrulandı. **KALICI
DERS: her review raporunda Codex'in GERÇEKTEN çağrıldığını (token kullanımı, session id gibi somut
kanıtla) teyit et, rapor formatına/self-report'a güvenme.**

**Task 17-25 bitince kullanıcı bir final whole-branch review istedi** (d268f96..1ecbb2e, 16
commit, Task 17-25'in TAMAMI tek diff'te). Codex (`model_reasoning_effort=high`) 9 task'ın TEK TEK
doğru ama BİRLİKTE eksik bıraktığı **1 BLOCKER + 4 MAJOR + 3 MINOR gerçek cross-task entegrasyon
sorunu** buldu:
- **BLOCKER:** `.github/workflows/ci.yml`'nin smoke-API adımı Task 20'nin yeni zorunlu
  `RULES_*` env değişkenlerini set etmiyordu — temiz bir CI çalışması artık `/health` smoke'unu
  hiç boot edemezdi.
- **MAJOR 1:** `admin-queue.service.ts`'te `take: limit` urgency hesaplanmadan ÖNCE uygulanıyordu
  — 100. sıradan sonraki acil (urgent) item'lar asla listeye giremezdi.
- **MAJOR 2:** `docs/rule-engine.md`'nin gerçekten talep ettiği bir `re_verify` öncelik seviyesi
  (tier) atlanmıştı; koddaki yorum bunun "hiçbir dokümanda istenmediğini" iddia ediyordu — bu
  iddia YANLIŞTI (Codex dokümanı bizzat okuyup doğruladı).
- **MAJOR 3:** `favoriler/page.tsx`'in render-time session-clear'ı yalnızca `lists`'i temizliyordu,
  `newListName`/`creating` gibi diğer session-scoped UI state'i unutmuştu — aynı sınıf privacy
  sızıntısının küçük ölçekli bir tekrarı.
- **MAJOR 4:** `kuyruk`/`import` sayfalarının 401 yolu `signOut()`'u `await` etmiyordu (veya
  hata dönüşünü kontrol etmiyordu) — `erisim-yok`/`layout.tsx`'in kendi doğru deseniyle tutarsız.
- **MINOR'lar:** `favorite-button.tsx`'in dual-counter'ı identity değişiminde reset olmuyordu;
  JWT guard→403 zincirini GERÇEKTEN uçtan uca test eden bir e2e yoktu (var olanlar hep bir yerde
  bypass ediyordu); apps/admin'in bilinen tek eski test hatası aslında yapısal olarak imkansız bir
  senaryoyu test ediyordu (production `getQueue` her zaman yalnızca `type=REPORT` gönderiyor).

Hepsi **Task 26** olarak tek seferde (5 commit: `a3832d1`, `8f4ed9b`, `911189d`, `cd4e875`,
`c0e2e80`) düzeltildi. Sonuç: **apps/admin ilk kez tarih boyunca 60/60, sıfır hata** (eski
`getQueue` baseline hatası da bu turda gerçekten kapandı). Tüm 5 paket (apps/api 225/225,
apps/web 132/132, apps/admin 60/60, packages/api-client 7/7, packages/shared 50/50) yeşil,
`tsc --noEmit` ve `eslint` temiz.

**Task 26'nın kendi review'ı Codex kotasının tükenmesiyle bloke oldu** — `codex exec` iki ayrı
denemede de ("gerçek 8 maddelik prompt" ve "sadece OK yaz" minimal prova) aynı hatayı verdi:
`ERROR: You've hit your usage limit ... try again at Aug 1st, 2026 11:26 PM`. Bu prompt-boyutu
veya `model_reasoning_effort` sorunu DEĞİL — gerçek ChatGPT Plus kota tükenmesi, **kota sıfırlanma:
2026-08-01 23:26 (Türkiye saati).** Global CLAUDE.md kuralı gereği ("kota bitince sessizce başka
modele kaçma — dur, kullanıcıya söyle") kullanıcıya durum bildirildi; kullanıcı GLM'e geçmeyi veya
self-review'ı kabul etmedi, **1 Ağustos'u beklemeyi seçti.**

**Bu bekleme sırasında (2026-07-29/30) kullanıcı iki iş istedi, ikisi de tamamlandı:**

1. **Doküman temizliği** (commit `cd9084c`): `docs/CHANGELOG.md`'nin 2026-07-25'ten beri (Plan 4b,
   Plan 4c, tam A-Z denetim, Task 17-26 dahil hiçbiri) kayıtsız kalan büyük boşluğu tek konsolide
   girdiyle dolduruldu. Birkaç eski "ertelenen madde" iddiası (isBoutique'ın artık `status !==
   "PUBLISHED"` kontrolü içermesi, REPORT onayının artık `Venue`/`verifiedAt`'e hiç dokunmaması,
   open-now filtresinin implemente edilmiş olması, eslint kuralının hâlâ `"warn"` seviyesinde
   kalması) gerçek kodda `grep`'lenerek doğrulandı, varsayımla yazılmadı. `docs/RISK-MITIGATION.md`
   ve `docs/AUDIT-2026-07-26.md`'ye "bu artık tarihsel kayıt, aktif eylem listesi değil" işaret
   notu eklendi (ikisi de kendi içinde eski, çözülmüş kararlara "henüz karar verilmedi" diyordu).

2. **Plan 4 (Infra/CI/KVKK/Pilot) tasarım taslağı** — kullanıcı talebi: "durmadan Plan 4 için
   Codex'e kadar gerekli her şeyi hallet." STATE.md/SESSION-LOG'da dağınık duran dört kalem
   (gerçek altyapı provisioning'i, Supabase Auth↔Prisma User senkronizasyonu, KVKK metinleri,
   pilot karar metrikleri için event-capture) tek bir taslakta toplandı
   (`docs/superpowers/specs/2026-07-29-infra-launch-design.md`, commit `b9045a5`) — 5 açık soru
   ile kullanıcıya sunuldu. Kullanıcı cevapları (2026-07-29):
   - Event-capture: **kendi Postgres tablosu**, üçüncü parti araç (Plausible/PostHog) DEĞİL.
   - Hesap silme akışı: **kapsamda**, ayrıca **admin panelden görülebilir** olmalı.
   - Provisioning ile KVKK/analytics: **ayrı plana bölünsün** — kullanıcı kendi kendine, benim
     önerdiğim gerekçeyle (biri normal TDD/kod, diğeri hesap-açma/runbook — farklı yürütme şekli)
     aynı sonuca ulaştı.
   - KVKK metinlerinin hukuki onayı: **en sona bırakıldı**, bu planın kapsamında değil.
   - "Hesap açma/ödeme" ne demek sorusuna: Supabase/Railway/Vercel/Cloudflare'de GERÇEK (bazıları
     ücretli) hesaplar açmak olarak açıklandı.

   Sonuç, taslak ikiye bölündü (commit `2ff0c50`), orijinal taslak ARŞİV olarak işaretlenip
   içeriği korundu:
   - **Plan 4d** — `docs/superpowers/specs/2026-07-29-plan4d-kvkk-analytics-design.md`: KVKK
     aydınlatma/rıza metni + `AnalyticsEvent` tablosu/repository + 3 event noktası (`MAPS_CLICK`,
     `FAVORITE_ADD`, `SHARE_CLICK`) + 4. hafta geri dönüş kohort raporu (admin panelde) + hesap
     silme akışı (`DELETE /v1/me`, soft-delete/log kararı açık). Tamamen kod+doküman, gerçek
     hesap gerektirmiyor, normal `subagent-driven-development`/TDD ile yürütülebilir. **4 açık
     soru kaldı** (dosyanın §4'ü): (a) hesap silme Supabase Auth kaydını da mı siliyor yoksa
     yalnızca Prisma `User`'ı mı; (b) admin görünürlüğü soft-delete (`deletedAt`) mi yoksa ayrı
     PII-içermeyen bir log tablosu mu; (c) favoriden ÇIKARMA da "karar eylemi" sayılır mı yoksa
     yalnızca EKLEME mi; (d) anonim (giriş yapmamış) kullanıcı event'leri de yakalanmalı mı.
   - **Plan 4e** — `docs/superpowers/specs/2026-07-29-plan4e-provisioning-runbook-design.md`:
     gerçek Supabase/Railway/Vercel/Cloudflare provisioning + Supabase Custom Access Token Hook
     (Auth↔Prisma User sync, Task 17'nin role-case fix'inin production'da İLK KEZ gerçek veriyle
     test edileceği yer) + gerçek env değerleri + gerçek smoke test + go-live. Kod ÜRETMİYOR —
     `subagent-driven-development`'ın diff-review döngüsüne uymuyor, adım adım bir runbook olarak
     tasarlandı; her hesap açma/ödeme adımında kullanıcı onayı ayrıca istenecek (genel proje
     kuralı: geri dönüşü zor/parasal işlemler önce onay gerektirir). **3 açık soru kaldı**
     (dosyanın §6'sı): (a) bütçe/zamanlama — adımlar ne zaman, hangi kartla; (b) domain zaten var
     mı yoksa yeni mi alınacak; (c) admin paneli erişim kısıtlaması Vercel seviyesinde mi yoksa
     yalnızca mevcut `RolesGuard`'a mı güvenilecek.

   **`idea-red-team` (Codex) HİÇBİRİ İÇİN ÇALIŞTIRILMADI** — aynı kota bloğu.

## SIRADAKİ ADIM (yeni bir oturum buradan devam etmeli)

1. **Önce kontrol et:** kota gerçekten döndü mü (`codex exec "OK yaz"` gibi minimal bir prova ile,
   büyük bir prompt harcamadan önce). Kota bilgisi: 2026-08-01 23:26 (Türkiye saati) — ama bu
   oturumun kendi tahmini, kullanıcıdan taze bir teyit iyi olur.
2. Task 26'nın (commit `1ecbb2e..c0e2e80`) review'ını gerçek Codex ile tekrar çalıştır. Review
   paketi zaten üretilmiş olabilir (`.superpowers/sdd/2026-07-26-frontend-fixes/` altında, git-
   ignored — yoksa `scripts/review-package` ile yeniden üret). 8 maddelik tam prompt bu dosyanın
   yukarıdaki Task 26 bölümünde özetlenmiş bulguların doğrulanmasını istiyor.
   - TEMİZ çıkarsa: final whole-branch review de tamamlanmış sayılır, kullanıcıya bildir, master'a
     merge kararını sor (kullanıcının kendi kararı, otomatik yapılmaz).
   - Bulgu çıkarsa: aynı fix→re-review döngüsüne devam et.
3. Task 26 TEMİZ olduktan sonra: kullanıcıya Plan 4d ve Plan 4e'nin kalan açık sorularını
   (yukarıda listelendi) sor, ya da kullanıcı "doğrudan Codex'e sorulsun" derse öyle ilerle.
4. Plan 4d ve Plan 4e'yi (muhtemelen paralel, ikisi de bağımsız taslak) `idea-red-team`'den geçir
   — her ikisi de HAZIR bloğu bekliyor. Round sayısı önceki planlarda 6-10 arasında değişti,
   şaşırma.
5. `idea-red-team` sonrası: `writing-plans` → `plan-red-team` → `subagent-driven-development`,
   standart akış. Plan 4e'nin gerçek hesap-açma adımlarında MUTLAKA durup kullanıcı onayı al.

---

## (ESKİ) ŞU AN NEREDEYİZ (2026-07-26, Plan 4b/4c tasarımı idea-red-team'den HAZIR aldı, writing-plans'a geçiliyor)

**Aktif iş:** Plan 4b (backend) + Plan 4c (frontend) tasarım dokümanları **5 idea-red-team
turundan** geçti (4 PIVOT + son turda HAZIR). Bulgular her turda küçüldü: round 1 (7 gerçek
mimari sorun: CSV ayrı şema, repository transaction-farkındalığı yok, findBySlug konum eksik,
open_now veri şekli uyuşmazlığı, z.coerce.boolean tuzağı, cron isim tutarsızlığı, trustProxy
riski) → round 2 (header backend'i sehven silinmiş, CSV boş hücre, districts/nearest projeksiyonu,
snapshot konumu, open_now timezone/malformed) → round 3 (pipe kapsamı, dahili filtre tipi,
seed.ts çağrı sitesi, admin-queue.service.ts'nin ayrı snapshot yolu, open_now regex saat aralığı,
isBoutique coerce bug'ı, C8 kullanıcı-etkileşim koruması, koşullu "en yakın" etiketi) → round 4
(OptionalTrueFlag deseninin KENDİSİ hatalıydı — Codex bunu bizzat çalıştırıp kanıtladı;
VenueDetailSchema'nın yeni alanları hiç içermemesi; nested district JSON kaybı; AdminQueueService
DI eksikliği) → **round 5: HAZIR** (kalan 2 küçük implementasyon detayı — header boş-string kenar
durumu, React-Leaflet immutable center prop'u — uygulandı, commit `aa775d5`).

**Sıradaki somut adım:** `writing-plans` skill'i ile önce Plan 4b (backend), sonra Plan 4c
(frontend, 4b'ye bağımlı) için implementasyon planları yazılacak. Ardından zorunlu `plan-red-team`
(Codex, HAZIR/DÜZELTİLEBİLİR-eşdeğeri bir sonuca kadar tekrar edilecek — Plan 4a'da 3 tur
gerekmişti, benzer bir döngü beklenmeli). Sonra `subagent-driven-development` ile yürütme, final
review (Superpowers + bağımsız Codex). **Hiçbirinde kullanıcıya onay sorulmayacak** (2026-07-26
talimatı) — yalnızca bu dosya her adımdan sonra güncellenecek.

---

## TAM KRONOLOJİ (bu oturumda yapılanlar, sırayla)

### 1. Oturum başlangıcı — worktree karışıklığı (ÇÖZÜLDÜ)
Bir önceki oturum session limitine çarpıp Plan 3 Task 7'nin ortasında yarım kesilmişti; root
`docs/STATE.md` hiç güncellenmemiş kalmıştı ("Plan 1 hiç başlamadı" diyordu). Bu oturum açılınca
bu bayat bilgiye güvenilip **yanlışlıkla `master`'da ikinci, gereksiz bir worktree açılıp zaten
bitmiş Task 0/1 tekrar yürütüldü**. Gerçek ilerlemenin `.claude/worktrees/mvp-backend-foundation`
(branch `worktree-mvp-backend-foundation`) adlı kilitli native worktree'de olduğu keşfedildi.
Yanlış worktree silindi, root STATE.md worktree'ye işaret edecek şekilde güncellendi, ders
STATE.md'ye kalıcı olarak yazıldı ("worktree'de ilerleme varsa root'a en azından işaretçi bırak").

### 2. Plan 3 (Admin panel) Task 7 tamamlandı
Kritik bir auth guard bug'ı (Fastify altında `JwtAuthMiddleware`'in `RolesGuard`'a hiç görünmemesi
— tüm admin API'si her zaman 403 dönüyordu) gerçek HTTP + gerçek Supabase JWT ile doğrulandı.
Final review (Superpowers/Codex-routed + bağımsız 2. Codex geçişi) **4 fix/re-review turu**
gerektirdi — her turda bir önceki fix'in kendisi yeni bir regresyon yarattı. 5. turda TEMİZ.
Ders (STATE.md'ye yazıldı): review loop'unu "muhtemelen temizdir" varsayımıyla erken kesme.

### 3. Plan 4a (packages/shared build fix) — tam döngü
- Brainstorming → tasarım → **idea-red-team 6 tur** (1-2: gereksiz kurumsal CI/CD koreografisi
  → kapsam yalnızca build fix'e indirildi; 3-6: `tsup`→düz`tsc`, smoke test yarış durumu,
  `prepare` script, `pnpm exec turbo` gibi mekanik detaylar).
- writing-plans → **plan-red-team 3 tur** (DB önkoşulu, curl timeout/exact-200, gerçek port
  uyuşmazlığı [54321/54322 örnek vs 54421/54422 gerçek], remote'suz repoda push varsayımı).
- subagent-driven-development ile 3 task yürütüldü, hepsi review'dan geçti.
- Final review: Superpowers + bağımsız Codex, ikisi de TEMİZ.
- **Plan 4a TAMAMLANDI.** Commit: `7f8bbc4` (ci: add real process-boot smoke test...).

### 4. Kapsamlı A-Z denetim (`docs/AUDIT-2026-07-26.md`)
Kullanıcı talebiyle: iki bağımsız Codex tam-kaynak denetimi (apps/api+packages/shared ayrı,
apps/web+apps/admin ayrı, TÜM production kaynak kodu inline verilerek — "kesif yapma, verilen
icerikle sinirla" talimatiyla, cunku ajanik kesif modu iki kez timeout'a ugradi) + kendi
spec-kapsam taramam (prd.md/api-spec.md karşı kod envanteri).

**Sonuç: "Pilot için hazır değil."** Backend: 1 CRITICAL + 16 HIGH. Frontend: 9 HIGH + 18
MEDIUM/LOW. En kritik bulgu: **API/admin üzerinden hiçbir mekan PUBLISHED yapılamıyor** (status
alanı create/update şemalarında yok). Diğer önemliler: konum koordinatı URL'ye yazılıyor (NFR-04
riski, gerçek hosting'e çıkılınca), kuyruk onayı içerik uygulamıyor, admin update versiyon
geçmişi tutmuyor, re-verify cron'u hiç bağlı değil, cursor pagination kırık.

Denetim raporu commit: `9d6bead`.

### 5. Plan 4b (backend) + Plan 4c (frontend) tasarımı — devam eden iş

**Kullanıcı kararı:** Denetimdeki TÜM bulgular tek bir "yeni plan" ile düzeltilsin (kullanıcının
kelimeleri: "bana sunduğun hataların tamamını yeni bir plan oluşturarak düzenle"). Brainstorming
sırasında backend/frontend'in bağımsız alt sistemler olduğu tespit edilip iki ayrı plana
(4b backend + 4c frontend) bölünmesi önerildi, kullanıcı onayladı.

**Brainstorming'de alınan 5 ürün kararı:**
1. Backend/frontend iki ayrı plan (4b + 4c).
2. A3 (REPORT onayı anlamı): "Onay = rapor haklı, ekip dışarıda düzeltti" — onay artık
   `verifiedAt`'i KENDİ BAŞINA güncellemez, asıl güncelleme ayrı bir admin-update adımında olur.
3. A1 (yayınlama): `status` alanı create/update şemasına eklensin (ayrı publish endpoint değil).
4. B3 (re-verify cron): 4b'ye dahil edilsin, gerçek cron bağlansın (pilot süresi 90 günlük eşiği
   hiç tetiklemeyecek olsa da, doğru altyapı olması için).
5. A2 (konum/NFR-04): REST semantiğini bozmadan `X-User-Location` header'ına taşınsın (GET
   query param yerine).

**İdea-red-team round 1: PIVOT.** Codex'in bulduğu, kodda doğrulanmış 7 gerçek mimari sorun:
CSV'nin ayrı şeması (status eklemenin CSV'yi etkilemediği), repository'nin transaction-farkında
olmaması (A4'ün `$transaction` deseni gerçek mimariyle uyumsuzdu), `findBySlug`'ın konum
döndürmemesi, `open_now`'ın gerçek veri şekliyle (`mon_fri`/`sat_sun`) uyuşmaması,
`z.coerce.boolean()` tuzağı, cron test/implementasyon isim tutarsızlığı, `trustProxy: true`'nun
"zararsız" olmaması.

**Bu turda alınan 2 ek kullanıcı kararı:**
1. CSV importa opsiyonel `status` kolonu eklensin, **varsayılan PUBLISHED** (kürasyon ekibi CSV'ye
   koymadan önce zaten doğruluyor).
2. Cursor pagination bu pilot ölçeğinde (30-45 mekan, tek sayfaya sığar) ertelensin, `limit`
   varsayılanı yükseltilsin.

**Tasarımlar round 2'ye revize edildi** (commit `3525640`) — 7 bulgunun hepsi işlendi + kullanıcı
kararları.

**İdea-red-team round 2: yine PIVOT** (ama bu kez "4/7 tam, 3/7 kısmi düzeltme", yaklaşım artık
temelde doğru, ayrıntı eksikleri var). Yeni/kısmi bulgular (hepsi kodda doğrulandı):
- Konum header'ının backend implementasyonu (round 1'de tasarlanan `@UserLocation()` decorator'ı)
  round 2 yeniden yazımında SEHVEN dokümandan düşmüştü.
- CSV boş `status` hücresi `""` üretir, Zod `.optional()` bunu "verilmedi" saymaz — normalizasyon
  gerekiyor.
- `/districts/nearest` projeksiyonu ÖNCEDEN BOZUK (yalnızca `{id,name}` seçiyor, şema `cityId`+
  `slug` da istiyor) — bu plandan bağımsız, pre-existing bir bug, ama bu plan bu alanı zaten
  düzenlediği için burada da düzeltilecek.
- Version snapshot/revert, PostGIS konumunu hiç kapsamıyor (Prisma'nın normal `venue` read'i bu
  kolonu okuyamıyor — ADR 002).
- `open_now`'da zaman dilimi garantisi yok, malformed `openingHours` tüm sorguyu düşürebilir.
- `AdminQueueMutationResultSchema` hâlâ yalnızca `REPORT` literal.
- (Frontend tarafı) `CategoryQuickRoute`'un "en yakın mekana git" önerisi mevcut veri
  sözleşmesiyle uyumsuzdu (VenueListItem'da koordinat/ilçe yok) — çözüm: koordinat eklemek
  yerine, zaten var olan isim+ilçe text-search deep-link desenini (venue-detail.tsx'teki
  `directionsUrl`) paylaşılan bir helper'a çıkarıp tekrar kullanmak (ilçe zaten sayfa seviyesinde
  biliniyor, yeni veri gerekmiyor).

**Şu an bu round 2 bulgularını iki tasarım dokümanına işliyorum** (yukarıdaki "ŞU AN
NEREDEYİZ" bölümündeki 6+2 madde).

---

## TÜM AKTİF/TAMAMLANMIŞ PLANLARIN DURUMU (özet tablo)

| Plan | Konu | Durum | Not |
|---|---|---|---|
| 1 | Backend + Data Foundation | ✅ 24/24 | final review temiz |
| 2 | Web/PWA consumer client | ✅ 12/12 | final review temiz |
| 3 | Admin panel | ✅ 7/7 | final review 4 tur sonrası temiz |
| 4a | packages/shared build fix | ✅ 3/3 | final review temiz, 6 idea-red-team + 3 plan-red-team turu |
| 4b | Backend kritik düzeltmeler (audit'ten) | 🔄 Tasarım aşaması | idea-red-team round 3 bekliyor |
| 4c | Frontend kritik düzeltmeler (audit'ten) | 🔄 Tasarım aşaması | Plan 4b'ye bağımlı, sırada |

**Hiçbir plan `master`'a merge edilmedi** — kullanıcı kararı: hepsi bitince tek seferde review
edilip merge edilecek. Bu, oturum boyunca değişmedi.

## ÖNCELİKLİ TAKİP MADDELERİ (Plan 4b/4c dışında kalan, ayrıca ele alınacak)

1. **Supabase Auth↔Prisma `User` senkronizasyonu yok** (trigger eksik) — kayıt olan kullanıcı ilk
   favoriyi eklerken FK hatası alabilir. Pilot açılmadan önce düzeltilmeli. **Plan 4b/4c'de YOK,
   ayrı ele alınacak.**
2. **Pilot karar metrikleri hiçbir yerde ölçülmüyor** (Maps'e gitme/kaydetme/paylaşma, 4. hafta
   dönüş — `prd.md §5`). Analytics/event-capture kodu hiç yok. Ayrı bir plan gerektirir.
3. Railway/Vercel/Supabase gerçek provisioning — hesap açılınca ayrı oturumda (Plan 4a'dan
   idea-red-team ile bilinçli çıkarılmıştı).
4. KVKK metinleri + pilot launch checklist (orijinal "Plan 4b" — şimdi audit-fix planları 4b/4c
   olduğu için bu muhtemelen "Plan 4d" olacak, henüz brainstorm edilmedi).
5. `apps/api/.env.example`'daki bayat Supabase port varsayılanları (54321/54322 vs gerçek
   54421/54422) — küçük, düşük öncelik.

## KALICI DERSLER (bu oturumda öğrenilen, tekrarlanmaması gereken hatalar)

1. Worktree'de ilerleme varsa root `docs/STATE.md`'ye en azından bir işaretçi bırak — tam
   detayı tekrarlama, ama "buraya bak" de.
2. Review/red-team loop'unu "muhtemelen temizdir" varsayımıyla erken kesme — Codex gerçekten
   TEMİZ/HAZIR diyene kadar devam et. Aynı dosya/mantık birden fazla kez düzeltiliyorsa bu
   regresyon riskinin arttığının işaretidir, azaldığının değil.
3. `codex exec`'e büyük içerik (diff veya kaynak kod) verirken: (a) stdin'den pipe et (`- < dosya`),
   asla komut satırı argümanı olarak embed etme ("Argument list too long" / hang riski); (b)
   ajanik keşif moduna bırakma (büyük kod tabanında kendi başına dosya okumaya çalışırsa timeout
   riski yüksek) — ilgili kaynağı doğrudan prompt'a inline et, "ek keşif yapma" talimatı ver;
   (c) `--sandbox read-only` bayrağı bu ortamda çalışmıyor gibi görünüyor (süresiz "düşünme"ye
   takılıp hiç yanıt üretmedi) — kullanma.
4. Bir tasarımı büyük ölçüde yeniden yazarken önceki round'da doğru olan bir bölümü (bu oturumda:
   konum header'ının backend implementasyonu) sehven silmemek için, revizyon sonrası yeni
   dokümanı eski dokümanla bölüm bölüm karşılaştır.
5. Bir "düzeltme" tasarımı yazmadan önce, iddia edilen mevcut davranışı (örn. "CSV zaten aynı
   şemayı kullanıyor", "bu alan zaten var") gerçekten kodda doğrula — varsayımla yazma. Bu
   oturumda idea-red-team bunu iki kez (CSV şeması, transaction mimarisi) yakaladı ve her ikisi
   de gerçekten yanlıştı.
6. PostGIS `Unsupported(...)` kolonları (ADR 002) Prisma Client API'nin normal `findUnique`/
   `findFirst`/model-read çağrılarında GÖRÜNMEZ — bu kolonu içeren her okuma (detay, snapshot,
   versiyon) `$queryRaw` ile `ST_Y`/`ST_X` kullanmak zorunda. Bunu unutmak bu oturumda 3 ayrı
   yerde (findBySlug, version snapshot, ilk A4 tasarımı) aynı hataya yol açtı.

---

## KULLANICI TALİMATI (2026-07-26, bu dosyanın yazılma nedeni)

> "Önce tüm herşeyi unutmamak için döküman haline getir... Tüm bunları yaptıktan sonra eğer sorun
> oluştuysa o sorun veya sorunları çöz eğer oluşmadıysa ve herşey tamamıyla okeyse öncelikli
> takip maddelerini sırasıyla yap plan yaz ve harekete geç planları bana sormana gerek yok
> şimdilik direkt harekete geçebilirsin ama ne yaptığını unutma ben sana sorduğumda anlat ve
> sorun çıksa da çıkmasa da yaptığın her işlemden sonra bir sonrakine geçmeden hatırlamamızı
> sağlayan dökümanı revize et."

**Yorumum:** Bundan sonra plan onayı için kullanıcıya sormayacağım — zorunlu red-team/review
geçitleri (idea-red-team, plan-red-team, final review + cross-model-review) hâlâ ÇALIŞACAK
(bunlar CLAUDE.md'nin değişmez kuralları, "kullanıcı onayı" değil "kalite geçidi"), ama her
geçit sonrası kullanıcıya durup sormak yerine sonucu bu dosyaya yazıp devam edeceğim. Yalnızca
gerçek, geri dönüşü zor kararlar (ör. `master`'a merge, gerçek hesap açma/harcama) için durup
soracağım — bunlar zaten önceden "kullanıcı onayıyla" olarak işaretlenmiş kalıcı kurallar.

---

## Plan 4b — writing-plans + plan-red-team (2026-07-26, bu talimat sonrası)

`docs/superpowers/plans/2026-07-26-backend-fixes.md` yazıldı (backend düzeltmeleri, audit
bulgularının A1/A3/A4 + B3-B16'sı). ADR 004 yazıldı (`docs/adr/004-user-location-via-http-header.md`)
— kullanıcı konumu artık `X-User-Location` header'ında, query param değil (NFR-04).

**plan-red-team 6 tur sürdü** (Codex, `model_reasoning_effort=high`), her turda gerçek bulgu:

- **Round 1 (YENİDEN BÖL):** Repository imza değişikliği (eski Task 3) production çağrı
  noktalarını (seed.ts, AdminVenuesService, AdminQueueService) 2-3 task sonra düzeltiyordu —
  aradaki `tsc`/`jest` iddiaları gerçekte FAIL verirdi. B11/B12 eksik, CSV `address` şemada yok,
  `open_now` fail-open PostgreSQL three-valued logic'iyle uyumsuz, `revert()` `any` kullanıyor.
- **Round 2 (YENİDEN BÖL):** Round 1'in düzeltmesi sorunu **çözmemiş, sadece etiketlemişti** —
  aynı kırık yapı korunmuş, "bu ara adımda test çalıştırma" notu eklenmiş. **KALICI DERS:** bir
  red-team bulgusuna "yorumla düzelt" değil, gerçekten yapıyı değiştirerek cevap ver.
  Kod okundu (venues.repository.ts, admin-venues.service.ts, admin-queue.service.ts,
  roles.guard.ts, csv-import.service.ts, main.ts, her controller'ın `@Param` kullanımı) —
  placeholder'lar gerçek dosya/satır/metoda dönüştürüldü.
- **Round 3 (YENİDEN BÖL, ama farklı sınıf bulgu):** Tek-task/tek-commit birleşimi gerçekten
  tuttu ("Round 2'nin ana sorunu... dar anlamda çözülmüş" — Codex'in kendi ifadesi). Kalan
  bulgular: `searchPublished`'ın arama tarafındaki B11 hâlâ kırık (güncelleme tarafı zaten
  doğruydu), `AdminVenueRow`'a `address`/`photos` eklenmemiş, `snapshotToUpdateInput` `source`'u
  atlıyor, `tx: any`, task aşırı büyük (34 adım).
- **Round 4 (YENİDEN BÖL):** Task ikiye bölündü (Task 3 yazma/versiyonlama, Task 4 okuma/arama —
  gerçek caller sınırına göre). Ama Task 2 `VenueListQuerySchema`'dan `lat`/`lng`'yi kaldırıyordu,
  `searchPublished` (onları okuyan) Task 4'e kadar düzeltilmiyordu — karşılıklı bir acceptance
  döngüsü. **KALICI DERS:** "bu imza değişikliği bu task'a ait" derken, DEĞİŞEN TARAFI DEĞİL,
  DEĞİŞEN ŞEYİN GERÇEK TÜKETİCİSİNİ bul — şema Task 2'de, tüketicisi Task 4'te olursa hâlâ kırık.
- **Round 5 (YENİDEN BÖL):** `lat`/`lng` döngüsü kapandı ("gerçekten kapatmış" — Codex).
  **AYNI SINIF bulgu farklı alanda:** `VenueDetailSchema` (Task 2) `lat`/`lng`/`address`/`photos`'u
  zorunlu yapıyordu, `findBySlug` (Task 5) onları ancak sonra üretiyordu — aradaki her
  `GET /venues/:slug` runtime'da Zod validation hatası verirdi. Düzeltildi: şema değişikliği
  Task 5'e taşındı (findBySlug ile atomik). Ayrıca `BboxQuerySchema`'da aynı `Number("")===0`
  hatası tekrar üretilmişti (header parser'da bir kere düzeltilmişti) — düzeltildi.
- **Round 6 — döngü kapatıldı, kalan bulgular implementasyona bırakıldı:** Round 5'in kalan
  bulguları (gerçek HTTP route/verb'ler, `PrismaService` constructor şekli, `app.e2e-spec.ts`'in
  gerçek auth/client deseni, `featured`'ın revert'te geri yüklenip yüklenmeyeceği) gerçek dosya
  okumasını gerektiriyor — bu, per-task code review ve zorunlu `cross-model-review`'ın (gerçek
  diff'e karşı çalışır, plan metnine değil) işi. Karar: metin-bazlı plan-red-team döngüsü burada
  kesildi, kalan sınırlamalar plana açıkça yazıldı (silinmedi), implementasyona geçildi.

**KALICI DERS (bu round'ların ortak deseni):** Aynı sınıf hata (bir sözleşme değişikliğinin
tüketicisini yanlış task'a koymak) 3 kez farklı alan çiftinde tekrarlandı (`VenuesRepository`
callers → `VenueListQuery`/`searchPublished` → `VenueDetailSchema`/`findBySlug`). Bir sonraki
planda: **her Zod şema/tip değişikliği yazıldığında, "bu alanı gerçekten kim üretiyor, o üretici
aynı task'ta mı?" sorusunu açıkça sor** — "sonradan düzeltilecek" varsayımı üç kez yanlış çıktı.

**Sıradaki adım:** `subagent-driven-development` ile Task 1'den başla. Görev başına: implementer
subagent → code-reviewer subagent (spec uyumu + kalite) → düzeltme varsa tekrar review. Tüm task'lar
bitince final whole-branch review (Superpowers) + `cross-model-review` (Codex, zorunlu, ayrı).

---

## Plan 4b — subagent-driven-development yürütmesi (16/16 TAMAMLANDI, 2026-07-26)

Tüm 16 task implementer → code-reviewer (Codex-routed) döngüsüyle tamamlandı. Tam kayıt
`.superpowers/sdd/progress.md`'de (worktree-lokal, git-ignored, ama commit hash'leri git log'da
kalıcı). Özet:

- **Task 1-2**: Migration (`address`/`photos`) + `packages/shared` şema güncellemeleri. Task 2'nin
  implementer'ı brief'te kendi bıraktığım bir çelişkiyi (Step 8 prose vs Step 9 kod bloğu,
  `VenueDetailSchema` hakkında) doğru şekilde yakalayıp durup sordu — tahmin etmedi.
- **Task 3**: En büyük/riskli task (A1/A3/A4/B5 düzeltmeleri, transaction-aware repository + tüm
  çağıranları tek commit'te). **1 fix turu** gerektirdi: gerekçesiz cast, zayıf rollback test
  assertion'ı (gerçek FK hata koduna değil genel `toThrow()`'a bakıyordu), reviewer'ın yanlış
  konuma attığı bir `any` bulgusu (gerçek yeri `approve()` değil `list()`'teydi — implementer
  kendi araştırıp doğru yeri buldu).
- **Task 4**: Implementer session limit'e mid-task çarptı (Türkiye saatiyle 08:50 reset). Yaptığı
  iş commit edilmeden kaldı ama incelendiğinde tamamen doğru ve plana birebir uyumluydu — kontrol
  eden oturum dosya dosya doğrulayıp testleri/typecheck'i kendi çalıştırıp commit'i tamamladı,
  sonra normal review sürecine soktu (TEMİZ, 1 bilgilendirici MINOR: apps/web'in lat/lng kırılması
  zaten Plan 4c'ye planlı).
- **Task 5**: Reviewer 2 BLOCKER rapor etti (server-side response validation eksikliği,
  Date/string tip uyuşmazlığı) — ikisi de araştırıldı ve bu task'ın icat etmediği, kod tabanında
  zaten var olan desenler olduğu doğrulanıp gerekçeli reddedildi.
- **Task 6-14**: Sorunsuz veya 1 küçük fix turu ile TEMİZ (tipik bulgular: brief'ten miras kalan
  gerekçesiz `as any`'ler — 3 kez, hep aynı kök neden: plan metnindeki örnek kodun kendisi `any`
  kullanıyordu).
- **Task 15**: **3 fix turu** gerektirdi — en uzun döngü. `AllExceptionsFilter`'ın tip parametresi
  eksikti; Retry-After korunduğu iddiası gerçek `bootstrap()` kablolamasından geçmiyordu (yeni e2e
  test eklendi); o yeni testin `x-forwarded-for` izolasyon iddiası yanlış çıktı (Fastify `req.ip`
  `trustProxy` olmadan header'ı hiç görmüyor); düzeltmede kullanılan DELETE sorgusu yanlış anahtar
  hedefliyordu (`report` yerine gerçek metod adı `submit`) — kök neden (magic string drift)
  programatik türetmeyle kalıcı çözüldü.
- **Task 16 (final regression)**: Doğrudan orkestratör oturumu tarafından çalıştırıldı (kod
  değişikliği gerektirmeyen bir checkpoint bekleniyordu, ama gerçekten iki gerçek hata bulundu):
  (1) `not-a-uuid` e2e testi kendi rate-limit sayacını sıfırlamıyordu, tam suite çalıştığında
  flaky'ydi — Task 15'in kurduğu reset deseniyle düzeltildi; (2) `turbo lint` 6 gerçek
  `no-require-imports` hatası buldu (Task 12/14'ün testlerinde) — ikisi de gerekçeli
  eslint-disable veya (main.spec.ts'de gereksiz olduğu için) statik import'a çevrilerek
  düzeltildi. Kendi yazdığım kodu "kendi review etme" kuralına uyarak ayrıca review'a soktum
  (DÜZELTİLEBİLİR, 2 kozmetik yorum-doğruluğu notu, düzeltildi).

**Manuel adım atlandı:** Task 16'nın Step 3'ü (gerçek curator JWT ile curl smoke test) gerçek bir
Supabase login akışı gerektiriyor, bu otomatik akışta uydurulamaz — A1'in otomatik kanıtı zaten
Task 3/6'nın test suite'lerinde var.

**Bu round'un tekrarlayan deseni:** Plan metnindeki örnek kod bloklarının kendisi birden fazla
kez (Task 8, 9) gerekçesiz `any` içeriyordu ve implementer'lar bunu olduğu gibi uyguladı — plan
yazarken kod örneklerinin kendisinin de proje kurallarına (any yasak) uyup uymadığını kontrol
etmek gerekiyor, sadece mantığın doğruluğunu değil.

**PLAN 4B: 16/16 TAMAMLANDI.** Sıradaki adım: final whole-branch review (Superpowers final
code-reviewer + ayrıca `cross-model-review` skill'i, ikisi de zorunlu, atlanamaz).

---

## Plan 4b — final whole-branch review (2026-07-26, TAMAMLANDI)

52 commit'lik tam diff'e karşı (2ef1db6..9c6b7e6) Codex ile final review, 2 fix turu:

**Round 1 (0 BLOCKER, 4 MAJOR):**
1. Yalnızca `lat` veya yalnızca `lng` verilen bir admin update isteği konumu sessizce
   güncellemiyordu ama yine de `VenueVersion` snapshot alıp `verifiedAt`'i tazeliyordu — sanki
   konum gerçekten yeniden doğrulanmış gibi. **Gerçek bug.** Düzeltme: `AdminVenueUpdateSchema`'ya
   `lat`/`lng`'nin ikisi-birlikte-veya-hiçbiri olmasını zorunlu kılan bir `.refine()`.
2. `X-User-Location` header'ı elle parse ediliyordu, "tüm girdi packages/shared Zod şemasından
   geçer" kuralını ihlal ediyordu. Düzeltme: `UserLocationHeaderSchema` eklendi, decorator ona
   delege edecek şekilde yeniden yazıldı (dış davranış/imza aynen korunarak).
3. Admin kuyruk endpoint'inin `type`/`status` query parametreleri Zod'dan geçmeden Prisma enum'a
   cast ediliyordu — geçersiz değer 500'e düşüyordu. Düzeltme: `AdminQueueListQuerySchema` eklendi.
4. Branch genelinde net +55 gerekçesiz `any` (13 dosyada +74/-19) — araştırıldı, TAMAMEN test
   mock dosyalarında olduğu doğrulandı (üretim kodunda sıfır), hacim artışıyla orantılı (Plan 4b
   ~40 yeni test dosyası ekledi, hepsi zaten kabul edilmiş Prisma-mock `as any` desenini
   izliyor) — kod değişikliği değil, `docs/STATE.md`'nin "134 uyarı değişmedi" iddiası
   düzeltildi (gerçek sayı zaten 86'dan büyümüştü, ama bu beklenen/kabul edilebilir).

Ayrıca Codex'in kendi test koşusu 131 test rapor etmişti (beyan edilen 162'ye karşı) — kontrol
eden oturum kendi `npx jest` çalıştırmasıyla 162/162'yi doğruladı, fark Codex'in ortamında geçici
bir sorun olmalı (muhtemelen local Supabase stack o an ayakta değildi).

**Round 2 (round 1'in düzeltmelerinin re-review'ı, 0 BLOCKER, 1 MAJOR + 2 MINOR):**
- **Gerçek regresyon:** `AdminQueueListQuerySchema.type` yalnızca `REPORT`/`EDIT` kabul ediyordu,
  ama gerçek `ContributionType` enum'u 4 değer içeriyor (`NEW_VENUE`/`OWNER_VERIFICATION` da var)
  — önceden çalışan filtreleme artık 400 dönüyordu. `AdminQueueItemSchema`'nın (farklı, bilinçli
  dar) şemasıyla karıştırılmıştı. Düzeltme: query şeması 4 değere genişletildi, item şeması
  dokunulmadı.
- 2 kozmetik MINOR: yanlış yere kaymış bir yorum bloğu, bir fix raporundaki tekrarlanamayan
  "flaky test" iddiası (araştırıldı, tekrarlanmadı, rapor dürüstçe düzeltildi, silinmedi).

**Round 3 (round 2'nin düzeltmelerinin re-review'ı):** TEMİZ. "İki round'luk final whole-branch
review + re-review döngüsü burada gerçekten tamamlanmış."

**KALICI DERS:** Final whole-branch review, tek tek TEMİZ geçen 16 task'ın bile kaçırdığı 2 gerçek
bug buldu (partial-coordinate + false-reverify; query şema karışıklığı) — "her task ayrı ayrı
temiz" ile "bütün birlikte doğru" arasında fark var, ikisi de ayrı ayrı gerekli.

**PLAN 4B: GERÇEKTEN TAMAMLANDI.** `master`'a henüz merge yok (kullanıcı kararı: her şey bitince
tek seferde). Sıradaki: Plan 4c (frontend düzeltmeleri) — `writing-plans` → `plan-red-team` →
`subagent-driven-development`, aynı süreç.

---

## Plan 4c (frontend/admin düzeltmeleri) — plan-red-team (2026-07-26/27, 10 round)

Plan 4c'nin implementasyon planı (`docs/superpowers/plans/2026-07-26-frontend-fixes.md`) Plan 4b'nin
6 turunu aşarak 10 plan-red-team turu gerektirdi:

- **Round 1-2:** klasik task-sözleşme çakışmaları (bir görev bir dosyayı üretiyor, başka bir görev
  aynı dosyayı farklı şekilde tüketici olarak iddia ediyor) — üretici+tüketici tek task'ta
  birleştirilerek çözüldü.
- **Round 3-4:** planın hayali arayüzlere göre yazıldığının keşfi — `VenueMapLeaflet` marker array
  almıyor (gerçek: `VenueMap` → `next/dynamic` ile `VenueMapCanvas`, bbox self-fetch), `createList`
  yok (gerçek: `createFavoriteList(token, name)`), favoriler sayfası zaten tüm listeleri kart olarak
  gösteriyor (switcher gereksiz), `VenueFilters`'ın prop'u `value` (`filters` değil). Bir Explore
  agent ile ground-truth pass yapıldı; round 4 bu pass'in bile bazı satırları (örn.
  `serializeFilters`'ın gerçekten `lat`/`lng` ürettiği) kaçırdığını buldu — **KALICI ders: bir
  önceki pass'e güvenme, her rewrite'tan hemen önce şüpheli iddiaları tekrar `grep`/`Read` ile
  doğrula.**
- **Round 5 (en ciddi bulgu):** eski birleşik "discovery/map/quick-route" task'ını 3 dilime bölerken
  (yeniden numaralandırma sırasında) **tüm bir görev (C1/C11/C12 hata yönetimi) sessizce plandan
  düştü** — silinmedi, yalnızca unutuldu. Hiçbir yapısal kontrol bunu yakalamadı. **KALICI çözüm:**
  plan başına her C-maddesinin hangi task'a atandığını gösteren açık bir çapraz-referans tablosu
  eklendi; her rewrite'tan önce bu tablo tekrar doğrulanmalı.
- **Round 6-10:** giderek küçülen yerel düzeltmeler — imkânsız test geçişleri (bir kategori
  tıklandıktan SONRA auto-sort'un yine de tetiklenmesini beklemek, tasarımın kendi guard'ına aykırı),
  eksik fixture alanları (`satisfies VenueListItem` ile TypeScript daraltma sorunu), design doc/plan
  uyumsuzlukları (C4/C6/admin metni), gerçek dosyalarla son kez çapraz doğrulama.

Round 10: **HAZIR**. Detaylı round-by-round bulgular ve gerekçeler `docs/superpowers/plans/
2026-07-26-frontend-fixes.md`'nin başındaki "Round N plan-red-team" bölümlerinde kalıcı olarak
kayıtlı (silinmedi, her round bir öncekinin üzerine yazılmadı, ekstra bağlam olarak korundu).

## Plan 4c — subagent-driven-development (2026-07-27, 16/16 TAMAMLANDI)

Tam ilerleme kaydı `.superpowers/sdd/progress.md`'de (worktree-lokal, git-ignored, ama commit
hash'leri git log'da kalıcı). Özet:

- **Task 1-2, 5-6, 8-13, 15:** tek seferde TEMİZ (bazılarında 1 kayda değer MINOR, davranışı
  etkilemeyen). Task 5'in implementer'ı brief'in örnek `useMap()` mock'unun gerçek bir sonsuz
  render döngüsü ürettiğini kendi kendine yakalayıp düzeltti (test her çağrıda yeni obje
  döndürüyordu, `BoundsVenueLoader`'ın `[loadVisibleVenues, map]` effect'ini sonsuza tetikliyordu).
- **Task 3 (hata yönetimi C1/C11/C12):** 2 fix turu. Round 1: `initialCheckPending` kullanıcı
  null→gerçek geçişinde yeniden silahlanmıyordu + mount-time `getFavoriteLists` çağrısında
  `.catch()` yoktu (2 MAJOR) artı 2 MINOR. Round 2: round 1'in düzeltmesi gerçek bir ESLint
  regresyonu bıraktı (kayıtlı olmayan bir kuralı disable etmeye çalışmak) VE `handleClick`'in kendi
  async zincirinde hâlâ açık bir race vardı (favorileme sırasında `venueId` değişirse yanlış mekan
  favorilenmiş görünebilirdi) — `venue-map-leaflet.tsx`'in `latestRequest` deseni mirror'lanarak
  düzeltildi.
- **Task 7 (venue detail map):** 1 fix turu. React-Leaflet'in `MapContainer.center`'ının mount
  sonrası immutable olması (aynı sorunun Task 5'te de çözüldüğü desen) `key={venue.id}` ile
  düzeltildi; testin `focusVenue` modunu gerçekten kanıtlamadığı (yalnızca `center` tesadüfen
  eşleşiyordu) bulgusu mock prop assertion'ıyla güçlendirildi.
- **Task 12 (klavye erişilebilirliği C14):** review'da 3 MINOR (biri gerçek olmadığı Codex'in kendi
  `@react-leaflet/core` kaynak kodu okumasıyla kanıtlandı — mock harness sadakatsizliği, üretim
  bug'ı değil); tek gerçek eksik test kapsamı (`focusVenue` durumu için tam assertion) doğrudan
  eklendi.
- **Task 14 (boutique/openNow toggle, en acil düzeltme):** 1 fix turu. Toggle butonu düzeltildi
  ama `serializeFilters`'ın kendisi hâlâ `!== undefined` kontrolüyle savunmasızdı — herhangi bir
  gelecekteki çağıran `isBoutique:false` geçerse yine 400'e düşerdi. `openNow`'un zaten kullandığı
  truthy-check desenine (`=== true`) çevrildi, doğrudan-çağrı regresyon testiyle kanıtlandı.

**Task 16 (final regresyon, 2026-07-27):** apps/web 111/111 test + tsc temiz; apps/admin 39/40
(1 hata Plan 4c'den TAMAMEN bağımsız, pre-Plan-4c baseline'da (`1fc7333`) da başarısız olduğu
doğrulandı — `getQueue` non-REPORT item reddi eksik, ayrı bir oturumda düzeltilmeli);
packages/api-client 2/2; `turbo typecheck lint` 0 hata (yalnızca 2 önceden kabul edilmiş
any/unused uyarısı). C1-C14 çapraz-kontrolü: plan'ın kendi tablosundaki her madde tam olarak bir
task'a atanmış, kayıp/çift yok.

**PLAN 4C: 16/16 TAMAMLANDI.** Sıradaki: mandatory final whole-branch review (Codex-yönlü
`code-reviewer`, Plan 4b'nin sürecini tekrarlayarak — round round TEMİZ'e kadar).

**PLAN 4C: GERÇEKTEN TAMAMLANDI (2026-07-27).** 16/16 task + final whole-branch review (opus
modeliyle, 8 cross-task entegrasyon noktası özellikle kontrol edilerek) TEMİZ. `master`'a henüz
merge yok (kullanıcı kararı: her şey bitince tek seferde). Manuel tarayıcı smoke testi (gerçek
Leaflet SVG odak/klavye davranışı, district navigasyonunda map remount) bu otomasyon ortamında
yapılamadı, kullanıcı tarafından ayrıca doğrulanmalı.
