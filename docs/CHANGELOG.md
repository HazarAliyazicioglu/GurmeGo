# GurmeGo — Changelog

Bu dosya spec/karar seviyesindeki değişiklikleri kaydeder. Her girdi: ne değişti, neyle
değiştirildi, neden. En yeni en üstte.

---

## 2026-07-25 — Plan 1/2/3 tamamlandı (worktree'de), root/worktree senkronizasyon dersi

### Bağlam
Bu tarihten itibaren kod ilerlemesi artık bu dosyanın implied ettiği "henüz kod yok" durumundan
öteye geçti — ama **`master` branch'inde değil**, kilitli bir native worktree'de
(`.claude/worktrees/mvp-backend-foundation`, branch `worktree-mvp-backend-foundation`). Bir önceki
oturum session limitine çarpıp Plan 3 Task 7'nin ortasında yarım kesilmişti; root `docs/STATE.md`
hiç güncellenmemiş kaldı. Bu oturum açıldığında root'tan devam edilmeye çalışılınca bu STATE.md'nin
"Plan 1 hiç başlamadı" beyanına güvenilip **yanlışlıkla ikinci, gereksiz bir worktree açılıp zaten
bitmiş Task 0/1 tekrar yürütüldü** — worktree keşfedilince fark edilip geri alındı.

### Durum (bu tarih itibariyle, worktree'de)
- **Plan 1 (Backend + Data Foundation): 24/24 task ✅**, final review temiz.
- **Plan 2 (Web/PWA consumer client): 12/12 task ✅**, final review temiz.
- **Plan 3 (Admin panel): 7/7 task ✅.** Task 7'nin final review'ı 4 fix/re-review turu gerektirdi —
  her turda bir önceki fix'in kendisi yeni bir regresyon yarattı (JWT guard fix → kuyruk sayfası
  hata yönetimi → o fix'in kendi regresyonu → CI lint script'i → header metni → test assertion
  gücü), 5. Codex geçişi TEMİZ verdi. Ayrıntı: worktree'nin `.superpowers/sdd/progress.md`'si.
- Hiçbir plan henüz `master`'a merge edilmedi (kullanıcı kararı, sabit).

### Değişiklikler / dersler
| # | Neydi | Ne oldu | Neden |
|---|---|---|---|
| 1 | Root `docs/STATE.md`, worktree'de anlamlı ilerleme olsa bile güncellenmiyordu | Root STATE.md artık worktree'nin varlığını ve genel durumunu özetleyen bir işaretçi tutuyor, tam detayı tekrarlamıyor | Senkronizasyon eksikliği bu oturumda gerçek bir iş tekrarına (duplicate worktree + tamamlanmış Task 0/1'in yeniden yürütülmesi) yol açtı |
| 2 | Final review'da tek fix turuyla "muhtemelen temizdir" varsayımı | Review loop'u Codex gerçekten TEMİZ diyene kadar sürdürme kuralı somut bir örnekle doğrulandı (4 tur) | Her turda önceki fix kendi regresyonunu yarattı — özellikle aynı state/dosya birden fazla kez dokunulduğunda risk artıyor, azalmıyor |
| 3 | `codex exec`'e büyük diff'i (>150KB) tek komut satırı argümanı olarak verme | Diff stdin'den pipe ediliyor (`codex exec - < prompt.txt`), gerekirse mantıksal parçalara bölünüyor | Argüman limiti aşımı ("Argument list too long") ve/veya süresiz hang riski |

---

## 2026-07-16 — Red-team pivotu: kapsam daraltma

### Bağlam
`idea-red-team` skill'i ile proje Codex'e (GPT-5.6 Sol, `model_reasoning_effort=high`) yıktırıldı.
Orijinal spec seti (2026-07-06, hiç kod yazılmadan 10 gün bekleyen 8 doküman) için verdikt: **NO-GO**.

**Codex'in gerekçesi (özet):** Düşük frekanslı bir keşif davranışını, gelir modeli olmayan ve tek
kişinin sürdüremeyeceği manuel veri operasyonuyla çözmeye çalışıyordu. Ölüm senaryoları: %45 proje
hiç ürüne dönüşmez (mimari tasarım hazzına kaymış), %35 ürün çıkar ama alışkanlık oluşmaz, %15 kullanım
gelir ama veri çürür. En riskli teknik parça AI/harita değil, menü/fiyat güncellik operasyonuydu (225
mekan için tahmini ayda 38-75 saat sadece doğrulama). Ayrıca aynı boşluğu hedefleyen dört rakip
bulundu: Menüde Ne Var, Menülen, HepMenu, Cafinder.

### Değişiklikler

| # | Neydi | Ne oldu | Neden |
|---|---|---|---|
| 1 | "Butik" tanımı: yalnızca `branch_count ≤ eşik` DB kuralı | Gerçek dünya kategorisi: zincir değil, ≤2-3 şube, Instagram/TikTok'ta mekan önerisi olarak dolaşan yerler (Burger King/Starbucks/Simit Sarayı gibi zincirlerin karşıtı) | Codex: eşik kullanıcı için anlamsız/keyfiydi, tanım kullanıcıya değil kurucunun sınıflandırmasına dayanıyordu |
| 2 | MVP hedefi: 3 ilçe × ~75 mekan = ~225 mekan | Sayı azaltılacak (kesin eşik henüz belirlenmedi); artış Faz 2'ye bırakılıyor | Codex: 225 kayıt tek kişi/küçük ekip için sürdürülemez bir editöryal yük |
| 3 | Tam menü sistemi (kalem + fiyat, MVP'de FR-MV-01/FR-MD-01) | Ortalama fiyat aralığı (₺/₺₺/₺₺₺) + "favori ürünler" alanı; tam menü sistemi ileri faza | Codex: menü/fiyat sürekli çürüyen envanter, en pahalı bakım kalemi. Bu, "en riskli teknik parça" bulgusuna doğrudan cevap |
| 4 | Kullanıcı katkısı MVP'de aktif (FR-KG-01/02) | Kullanıcı katkısı **ve** mekan-sahibi-kendi-bilgisini-girme akışı ileri faza alındı; MVP verisi kürasyon ekibinden | Codex: kullanıcı katkısı MVP'de çalışmaz döngüsü (katkı için kullanıcı lazım, kullanıcı için güvenilir veri lazım) |
| 5 | Ürün konumlanması: yeni bir keşif alışkanlığı yaratmak | Konumlanma değişti: TikTok/Instagram/Maps arasında gezinme alışkanlığını kırmak değil, "3-4 uygulama yerine tek yerden git" — kolaylaştırma/köprü | Codex: kullanıcı zaten IG/TikTok'tan Maps'e geçiyor, bu geçişi kırmak yeterince acı değildi |
| 6 | (yoktu) | Kategori bazlı rota: kullanıcı "tatlı" veya "kahve" seçtiğinde o kategorideki mekanlara filtre + yol tarifi | Konumlanma değişikliğinin doğal uzantısı |
| 7 | (yoktu) | WhatsApp paylaşım özelliği: kullanıcılar beğendikleri mekanı birbirine uygulama içinden gönderebilecek | Organik dağıtım/viral büyüme mekanizması eksikti (Codex: "bilinmeyenler" listesinde işaretlenmişti) |
| 8 | Kendi review sistemi (Review modeli), Google yorumları hiç yok | Google yorumlarına **deep-link** (Maps'e yönlendirme); Places API entegrasyonu yok | API'nin ToS kısıtları (attribution zorunlu, review metni 30 günden fazla cache'lenemez, ücretli istek) MVP'de gereksiz risk/maliyet. Kendi review sistemi FR-MD-02 olarak duruyor, ek olarak Google'a link veriliyor |
| 9 | Semantic search/pgvector MVP'de (FR-AI-02) | **Faz 2'ye alındı** (düzeltme: ilk yazımda "Faz 3" denmişti, kullanıcı "Faz 2" demek istediğini belirtti — ayrı bir Faz 3 katmanı yok, MVP → Faz 2 → İleri faz yapısı korunuyor). MVP arama tamamen yapısal filtre (kategori/fiyat/ilçe/mesafe), AI/pgvector/LLM çağrısı yok | Codex: birkaç yüz mekanlık veri setinde gereksiz karmaşıklık ("mühendislik kostümü"); kullanıcı en basit seçeneği (sadece yapısal filtre) onayladı |
| 10 | Gelir modeli tamamen açık | **Hâlâ açık** — freemium fikri beğenildi ama "o mantığa uyan bir sistem yok" (kullanıcı notu) | Codex: gelir modelinin "ertelenmesi" değil ürün mantığından çıkarılmış olması eleştirisi kısmen geçerliliğini koruyor |
| 11 | Kürasyon ekibi büyüklüğü belirtilmemiş | Netleşti: kullanıcı + 1-2 kişi daha | Codex'in "tek kişi sürdüremez" bulgusuna kısmi cevap — hâlâ küçük ekip, ama MVP kapsamı azaltılan mekan sayısıyla dengeleniyor |
| 12 | İlk kullanıcı kitlesi kaynağı belirtilmemiş | Netleşti: mevcut restoran/mekan bağlantıları + organik/SEO büyüme | Codex'in "dağıtım kanalı dokümanda yok, bu da olumsuz sinyal" bulgusuna cevap |

### Red-team bulguları — reddedilenler

- **"Gereksiz kılan çözüm var" (Menüde Ne Var, Menülen, HepMenu, Cafinder aynı boşluğu hedefliyor):**
  kısmen reddedildi. Gerekçe: konumlanma değişikliğiyle (kolaylaştırma/köprü + kategori bazlı rota +
  WhatsApp paylaşım + restoran bağlantıları üzerinden dağıtım) farklılaşma iddiası hâlâ var, ama bu
  rakiplere karşı nasıl kazanılacağı henüz test edilmedi. **Bu yanlışsa ne olur:** ürün yine "daha küçük
  veri tabanıyla aynı savaşa giren geç bir kopya" olarak kalır — rakip karşılaştırması yapılmadan MVP'ye
  girilirse aynı ölüm senaryosuna (%35, alışkanlık oluşmaz) düşme riski sürer.

### Uygulanan doküman güncellemeleri

Yukarıdaki tablonun tamamı şu dosyalara işlendi: `product-overview.md`, `prd.md`, `architecture.md`,
`rule-engine.md`, `api-spec.md`, `ai-prompt-design.md` (Faz 2 referansı olarak işaretlendi, silinmedi),
`infrastructure.md` (maliyet tablosundan AI kalemleri çıkarıldı), `development-guidelines.md` (test
stratejisi güncellendi).

### Sonraki adım
MVP mekan sayısı hedefi (~225 yerine ne kadar) netleşince `prd.md §1`'e yazılacak. Ardından ilk kod
turu: `architecture.md §3`'teki monorepo iskeleti.

---

## 2026-07-16 (devam) — Round 2 red-team + kullanıcı-perspektifi analizi

Kullanıcı isteği: kapsam güncellemeleri tamamlandıktan sonra projeyi Codex'e **tekrar** yıktır. Hâlâ
NO-GO ise, her bir sorun için 3-5 çözüm üret ve kaydet. Ayrıca kullanıcı yerine geçip ürünle ilgili
eksik/geliştirilebilir noktaları ayrıca değerlendir.

**Verdikt: hâlâ NO-GO**, ama round 1'e göre belirgin ilerleme var. Codex'in özeti: *"Uygulama ve bakım
riski ciddi ölçüde düştü, fakat çekirdek kullanıcı değeri ile tekrarlanabilir dağıtım hâlâ kanıtlanmadı;
mevcut tasarım 'tek yer' vaadini fiilen yerine getirmiyor."*

Round 1'in 6 eleştirisinden: 1 tanesi (semantic search) tam çözüldü, 3 tanesi (kapasite, UGC cold-start,
butik tanımı) kısmen çözüldü, 2 tanesi (rekabet, dağıtım) çözülmedi. Ayrıca yeni ve en temel bir sorun
ortaya çıktı: ürünün "Instagram → Maps → fiyat akışını tek yere toplama" iddiası gerçekte doğru değil —
Instagram içeriği alınmıyor, kesin fiyat yok, yorum/yol tarifi için yine Maps'e çıkılıyor. Ürün mevcut
3 adımı kısaltmak yerine 4. bir durak ekleme riski taşıyor.

7 sorunun her biri için 3-5 somut çözüm + öncelik sırası + kullanıcı-perspektifinden eksik/fazla analizi:
**[docs/RISK-MITIGATION.md](RISK-MITIGATION.md)**.

Henüz hangi çözümlerin uygulanacağına karar verilmedi — bu kullanıcıyla birlikte yapılacak sıradaki adım.

---

## 2026-07-24 — Round 3: 8 perspektifli panel + kullanıcı kararları

### Bağlam
Kullanıcı isteği: projeyi farklı uzmanlıklara sahip, paralel çalışan ve birbiriyle iletişim kurabilen
ajanlardan oluşan bir panele A'dan Z'ye tartıştır (ürün, mimari, frontend, backend, güvenlik, pazar,
büyüme dahil), Faz 2'ye ne gider/MVP'de ne kalır/ne değişir netleşsin, son karar kullanıcıda kalsın.

7 Claude subagent'ı (Ürün/UX, Backend/Mimari, Büyüme/Dağıtım, Veri/AI, Frontend, Güvenlik, Pazar) +
Codex (GPT-5.6, "karşıt görüş koltuğu") paralel çalıştırıldı; her biri tüm `docs/*.md` setini bağımsız
okuyup MVP'de-kalsın/Faz2/değişmeli/değişmemeli + riskler + sorular üretti. Round 2'de her ajana
diğerlerinin ve Codex'in bulguları geri gönderildi, tepki/itiraz istendi.

**Codex'in bulduğu, panelin kaçırdığı yeni risk:** Restoranlar hem beklenen dağıtım ortağı (kendi
takipçilerine paylaşmaları bekleniyor) hem de MVP'de anında yayınlanan yorum/editöryal
sınıflandırma/Gurme Puanı ile değerlendirilen taraf; mekan sahibinin itiraz/düzeltme akışı yok. Büyüme,
Ürün, Veri/AI ve Pazar ajanları bunu "kör noktaydım" diyerek kabul edip pozisyonlarını değiştirdi.

**Panelin genel verdikti:** Bugünkü kapsamla hâlâ NO-GO, ama daraltılmış bir pilotla (web/PWA, editör-only
öneri, Gurme Puanı yok) "yapılabilir" bir yola var. Tam rapor bu oturumda Artifact olarak yayınlandı.

### Panelde yakınsanan öneriler (round 2 sonrası)

| # | Konu | Round 2 sonrası ortak öneri | Kim değiştirdi/onayladı |
|---|---|---|---|
| 1 | Mobil istemci | React Native MVP'den çıkar, web/PWA ile pilot yap, talep doğrulanınca native'e geç | Ürün, Backend, Frontend, Codex |
| 2 | Gurme Puanı | Ertelemek değil, MVP'den tamamen çıkar — yalnızca imzalı editör önerisi kalsın | Ürün, Veri/AI, Pazar, Codex |
| 3 | Konumlanma | "Tek yerden toplayan platform" değil "rehber" (Michelin/Time Out tarzı, az sayıda seçici öneri) | Pazar, Ürün, Codex (bağımsız 3 yoldan aynı sonuç) |
| 4 | Restoran ilişkisi | "Ortak" değil, çıkar çatışması kabul edilip kürasyon bağımsızlığı yazılı ilkeye bağlanmalı | Pazar, Büyüme |
| 5 | Doğrulama sırası | Kod yazmadan landing page + kronometre testiyle doğrula | Büyüme, Codex — **kullanıcı reddetti, bkz. aşağı** |
| 6 | Mekan sahibi itiraz akışı | Minimal "bilgi yanlış/itiraz et" formu MVP'ye girsin | Ürün, Backend, Büyüme — **Güvenlik karşı çıktı, çözülmedi** |
| 7 | KVKK | Aydınlatma/rıza/saklama metni launch öncesi zorunlu | Güvenlik |

### Kullanıcı kararları — panelin bazı önerilerini geçersiz kıldı

- **Madde 5 reddedildi:** Kullanıcı ayrı bir landing page/kronometre ön-testi yerine minimal-ama-gerçek
  bir web/PWA ürünü inşa edip doğrulamayı gerçek kullanımla yapmayı tercih etti. Gerekçe: "ortaya bir
  ürün koymadan insanların test edip etmeyeceğini bilemeyiz."
- **Madde 6 ertelendi, çözülmedi:** Mekan sahibi itiraz akışı kararı pilot sonrasına bırakıldı — henüz
  kullanıcı çoğunluğu ve toksiklik riski yokken hızlı çözülebileceği gerekçesiyle.
- **Madde 7 sıralaması değişti:** KVKK metinleri MVP inşası öncesi değil, sistem şekillendikten sonra
  ve gerçek kullanıcı verisi toplanmadan hemen önce yazılacak.
- **Genel hedef:** Revize kapsamla en azından "yapılabilir" (idealde GO) bir MVP'ye ulaşmak — geliştirme
  devam ediyor.

### Round 3 red-team verdikti: KOŞULLU-GO (ilk kez NO-GO'nun ötesinde)

Revize kapsam Codex'e round 3 idea-red-team olarak gönderildi. **Verdikt: KOŞULLU-GO.** Codex'in özeti:
*"Önceki 'her şeyi toplayan ama hiçbir şeyi yeterince iyi yapmayan platform' sorunu büyük ölçüde kapanmış.
Web/PWA, az sayıda seçilmiş mekan ve imzalı editöryal öneri gerçek bir ürün tezi oluşturuyor."*

**Koşul:** Koddan önce sayısal bir "pilot karar sözleşmesi" yazılmalı — mekan sayısı, süre, başarı
metriği, bırakma eşiği belirlenmeden başlanırsa MVP doğrulama aracı değil, ucu açık bir geliştirme
projesi olur. Kullanıcı Codex'in önerdiği eşikleri **aynen kabul etti** (2026-07-24):

| Ölçüt | Eşik |
|---|---|
| Pilot kapsamı | 30–45 mekan (ilçe başına ~10–15) |
| Pilot süresi | 6 hafta |
| Kullanıcı edinimi | ≥150 hedef kullanıcı |
| Karar davranışı | ≥%25 Maps'e gitme/kaydetme/paylaşma |
| 4. hafta geri dönüş | ≥%20 |
| Veri uyuşmazlığı / bakım yükü | <%5 / ayda <30 insan-saat |

Diğer Codex notları: (a) gerçek ürünle doğrulama kararını "savunulabilir ama daha pahalı bir deney"
olarak nitelendirdi, riskini adlandırdı — "ürün yapmak duygusal bağlılık yaratır, başarısızlık karşısında
'bir özellik daha ekleyelim' döngüsüne girilir"; pilot süre/bütçe sınırı sabit tutulmazsa klasik
build-first yanılgısı. (b) Mekan sahibi itiraz akışının ertelenmesini bu ölçekte makul buldu ama sınır
koydu: 50+ mekan veya 8+ hafta veya görünür trafiğe çıkıştan sonra hâlâ itiraz yolu yoksa savunulamaz.
(c) KVKK metinlerinin geliştirme sonunda yazılmasını kabul etti, ama gerçek kullanıcı verisi
toplanmadan önce yayınlanmış olmalı — KVKK'nın kendi çerçevesi bunu gerektiriyor.

**CONFIDENCE:** Güven %82. Varsayımlar: kürasyon ekibi 2-3 kişi, içerik suçlayıcı değil, pilotta ücretli
tanıtım yok, gerçek kişisel veri launch öncesi toplanmıyor. Fikrini değiştirecek şey: pilotun sayısal
sınırları reddedilirse NO-GO'ya döner; güçlü erken kullanım/geri dönüş verisi tam GO'ya taşır.
Bilmediği: restoran bağlantılarının gerçek erişimi, ekibin haftalık kapasitesi, kullanıcı edinme maliyeti.

### Uygulanan doküman güncellemeleri
Pilot Karar Sözleşmesi + revize kapsam `prd.md` (§1, §2.5, §2.8, AK-01, §5) ve `product-overview.md`
(§1, §5, §6, §8) dosyalarına işlendi.

### Sonraki adım (güncellendi)
`superpowers:writing-plans` ile Plan 1/4 (Backend + Data Foundation) yazıldı:
`docs/superpowers/plans/2026-07-24-mvp-backend-foundation.md` — 24 task, TDD adımlarıyla, tam kod içeren.
3 ADR yazıldı (`docs/adr/001-003`): Redis yok/Postgres CacheStore, PostGIS $queryRaw izolasyonu, tek
NestJS monolit. Kalan 3 plan (web/PWA, admin UI, infra/CI/KVKK) sırayla, her biri kendi review'ından
geçtikten sonra yazılacak.

---

## 2026-07-24 (devam) — Plan 1 `plan-red-team` (Codex)

İlk 3 deneme, tam planı (24 task, ~30K+ token) okumaya çalışırken 10+ dakikada zaman aşımına uğradı.
Kısaltılmış bir sözleşme özeti (yalnızca Files/Consumes/Produces) hazırlanıp tekrar gönderildi —
**teknik not:** Codex CLI'nin sandbox'ı proje dizini dışındaki dosyaları (AppData\Temp) okuyamıyor gibi
görünüyor, özet dosyası proje içine taşınınca (`docs/superpowers/plans/`) denetim ~40 saniyede tamamlandı.

**İlk verdikt: YENİDEN BÖL.** Ama Codex'in kendi CONFIDENCE bloğu bunun özet kaynaklı olabileceğini
işaret ediyordu ("tam planda açık wiring, Swagger üretimi, update endpoint'i ve task-bağımlılıkları
bulunması" fikrini değiştirirdi). Bulgular tek tek değerlendirildi, gerçek olanlar plana işlendi:

- Eksik `PUT /admin/venues/:id` ucu → Task 16'ya eklendi
- `/v1` global prefix eksikti (`api-spec.md`'deki Base URL ile çelişiyordu) → Task 3 + Task 21'e eklendi
- `429` yanıtlarında `Retry-After` header eksikti → `RateLimitGuard`'a eklendi
- `RULES_MOD_AUTO_HIDE_REPORTS` eşiği iki yerde bağımsız okunuyordu (drift riski) → `rule-config.ts`'e çıkarıldı
- `jwt.strategy.ts` yanıltıcı isimlendirilmişti (Passport Strategy değil, NestMiddleware) → `jwt-auth.middleware.ts`
- `CACHE_STORE` provider wiring'i venues/districts/favorites modüllerinde eksikti → Task 20'ye netleştirildi
- ADR 001/002/003'te gerçek hatalar (crash/restart karışıklığı, "injection riski yok" aşırı kesinliği, blast-radius abartısı) → düzeltildi

**Genel "YENİDEN BÖL" verdikti reddedildi** — hiçbir bulgu task/dosya sınırlarının yanlış çizildiğini
göstermiyordu (paralel çalışacak iki task'ın çakışması gibi bir şey yok), hepsi ekleme/düzeltme
seviyesindeydi. Tam gerekçe ve "bu yanlışsa ne olur" analizi: planın kendi içindeki "Red-team bulguları"
bölümü.

### Sonraki adım
Kullanıcıya sonucu sun, yürütme onayı iste.
