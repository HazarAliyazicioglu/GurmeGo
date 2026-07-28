# Plan 4 (Infra/CI/KVKK/Pilot Launch) — Design

**Tarih:** 2026-07-29 · **Durum:** Taslak — `idea-red-team` (Codex) henüz çalıştırılmadı, kota
2026-08-01 23:26'ya kadar dolu. Kullanıcı onayı bekliyor.

İlgili: [infrastructure.md](../../infrastructure.md) · [prd.md](../../prd.md) §4-5 ·
[CHANGELOG.md](../../CHANGELOG.md) "2026-07-26/28" girdisi · [STATE.md](../../STATE.md)

---

## 0. Bu doküman nasıl üretildi (şeffaflık notu)

Kullanıcı talebi: "durmadan Plan 4 için Codex'e kadar gerekli olan her şeyi hallet." Standart
`brainstorming` akışı kullanıcıyla tek tek soru-cevap yapar; bu talep o adımı atlayıp doğrudan bir
taslak tasarım üretmemi istiyor. Aşağıdaki kararlar **benim varsayımım**, kullanıcı onayı almadı —
"Açık varsayımlar" bölümü (§7) bunları tek tek işaretliyor, kullanıcı geri döndüğünde ilk
düzeltmesi gereken yer orası olmalı.

## 1. Kapsam ve hedef

Mevcut dokümanlarda (STATE.md, SESSION-LOG, CHANGELOG'un yeni "2026-07-26/28" girdisi) "Plan 4"
olarak tekrar tekrar referans verilen, henüz brainstorm edilmemiş dört kalem:

1. **Gerçek altyapı provisioning'i** (Supabase projesi, Railway, Vercel×2, Cloudflare DNS) —
   `infrastructure.md`'de tasarımı var, hiçbiri gerçekten açılmadı.
2. **Supabase Auth↔Prisma `User` senkronizasyonu** (custom access token hook) — Plan 1'den beri
   ertelenen, gerçek Supabase projesi olmadan test edilemeyen tek kalem.
3. **KVKK aydınlatma/rıza/saklama metinleri** — `prd.md` §1 madde 6: sistem şekillendikten sonra
   ama gerçek kullanıcı verisi toplanmadan ÖNCE yayınlanmış olmalı.
4. **Pilot karar metrikleri için event-capture** — `prd.md §5`'teki Pilot Karar Sözleşmesi
   (Maps'e gitme/kaydetme/paylaşma "karar eylemi", 4. hafta geri dönüş kohortu) hiçbir yerde
   ölçülmüyor; Sentry/pino (genel hata/log) bunu karşılamıyor, ayrı bir olay yakalama katmanı
   gerekiyor.

**Hedef:** Pilotun (30-45 mekan, 6 hafta, ≥150 kullanıcı — Pilot Karar Sözleşmesi) gerçekten
başlayabilmesi için gereken TÜM altyapı + yasal + ölçüm ön koşullarını kapatmak. Kod tarafı
(Plan 1-4c + Task 17-26) zaten tamamlandı ve testten geçti — bu plan "koddan sonra kalan her şey."

**Kapsam DIŞI (bilinçli):** Gerçek hesap açma/ödeme işlemleri, gerçek domain satın alma, gerçek
KVKK hukuki danışmanlık onayı (metinleri yazarım ama bir hukukçuya onaylatmak kullanıcının işi).
Bunlar planın ADIMLARI olarak tanımlanır ama **gerçekten uygulanmadan önce kullanıcı onayı
zorunlu** (geri dönüşü zor/parasal işlemler — proje genel kuralı).

## 2. Neden tek plan, neden bölünmüyor (ya da bölünmeli mi?)

`brainstorming` skill'inin kuralı: bağımsız alt sistemler ayrı plana bölünmeli. Bu dört kalem
gerçekten bağımsız mı, yoksa gerçek bağımlılıkları mı var?

- **KVKK (3) → pilot metrikleri (4) bağımlılığı var:** event-capture kod yazılıp gerçek kullanıcı
  verisi toplamaya başlamadan önce KVKK metni yayında olmalı (`prd.md` madde 6, KVKK'nın kendi
  çerçevesi). Yani (4)'ün *devreye alınması* (3)'ten sonra gelmeli — ama (4)'ün *kodunun yazılması*
  bağımsız yapılabilir.
- **Provisioning (1) → Auth sync (2) bağımlılığı var:** custom access token hook gerçek bir
  Supabase projesi gerektiriyor, lokal Supabase CLI stack'inde test edilemez (Plan 1'den beri not
  edilen, doğrulanmış bir sınırlama).
- **(1) ve (3) birbirinden bağımsız** — provisioning ile KVKK metni yazımı paralel ilerleyebilir.

**Öneri:** Tek bir plan dokümanı ama İÇİNDE net bir sıralama/faz yapısı (aşağıda §4) — tam ayrı
plana bölmek (4d/4e/4f gibi) gerçek bir fayda sağlamıyor çünkü hepsi aynı "pilot başlayabilir mi"
sorusuna hizmet ediyor ve bir kısmı (KVKK metni yazımı, event-capture kodu) kod incelemesi
gerektirmiyor bile (doküman + küçük entegrasyon kodu). **Bu, `idea-red-team`'e sorulacak açık bir
sorudur** — Codex bölünmeye itiraz ederse (Plan 4b/4c'nin plan-red-team'inde olduğu gibi) plan
bölünecek.

## 3. Mimari yaklaşım (bileşen bazında)

### 3.1 Provisioning + gerçek CI/CD deploy wiring
`infrastructure.md`'nin tasarımı zaten var (Supabase/Railway/Vercel×2/Cloudflare). Plan 4a bilinçli
olarak **deploy job'unu tamamen planın dışında bırakmıştı** (idea-red-team NO-GO: "150 kullanıcılık
pilotun önüne kurumsal CI/CD koreografisi konulmasın", Railway/Vercel'in native git-push deploy'una
güvenilsin). Bu plan o kararı DEĞİŞTİRMİYOR — sadece o native deploy'un çalışması için gereken
gerçek hesapları/env değişkenlerini/DNS kaydını kurmayı kapsıyor, yeni bir CI/CD koreografisi
eklemiyor.

Somut adımlar:
- Supabase projesi aç (production), migration'ları gerçek DB'ye uygula (`prisma migrate deploy`).
- Railway'de API servisi aç, env değişkenlerini (`.env.example`'daki TÜM değişkenler — özellikle
  Task 17-26'nın eklediği `RULES_*`, `RATE_LIMIT_*`, `TRUST_PROXY_HOPS`, `SUPABASE_JWT_ISSUER`/
  `AUDIENCE`) gerçek değerleriyle doldur.
- Vercel'de web + admin için ayrı proje aç, `NEXT_PUBLIC_*` env değişkenlerini bağla.
- Cloudflare DNS kaydı.
- `TRUST_PROXY_HOPS` gerçek hop sayısına ayarlanmalı (ADR/`.env.example` yorumunda zaten not
  edilmiş — Railway'in kendi reverse proxy katmanı muhtemelen 1 hop, gerçek Railway dokümantasyonu
  kontrol edilmeli, varsayımla yazılmayacak).
- Health-check/smoke test gerçek prod URL'ine karşı çalıştırılmalı (Plan 4a'nın kurduğu smoke test
  deseni, gerçek ortama genişletilerek).

### 3.2 Supabase Auth↔Prisma User senkronizasyonu
Supabase'in "Custom Access Token Hook" özelliği (Postgres function, `auth.users` INSERT/UPDATE
trigger'ı veya Supabase'in kendi hook mekanizması — **hangisi olduğu gerçek Supabase Dashboard'da
doğrulanmalı, dokümantasyon versiyonuna göre değişebilir**) ile: yeni bir Supabase Auth kullanıcısı
oluştuğunda otomatik olarak Prisma'nın `User` tablosuna bir kayıt düşmeli (bugün bu yok — kayıt
olan bir kullanıcı ilk favoriyi eklerken FK hatası alabilir, `AUDIT-2026-07-26.md` D4'te + SESSION-
LOG'da zaten kayıtlı bilinen bir boşluk).

Ayrıca bu hook, JWT'nin `user_role` claim'ini gerçekten DB'deki role'den üretmeli — Task 17'nin
düzelttiği role-case normalizasyonu (`jwt-auth.guard.ts`, `auth-context.tsx`) bu hook kurulana kadar
**hiç test edilmemiş bir varsayımla** çalışıyor (lokal ortamda role claim elle/geçici olarak
enjekte edilerek doğrulandı, gerçek production hook'u henüz yok — bu Plan 3/Plan 4b/4c notlarında
zaten kayıtlı bir bilinen sınırlama).

### 3.3 KVKK metinleri
`prd.md` NFR alanında KVKK'ya doğrudan referans yok ama §1 madde 6'da açık karar var: "sistem
şekillendikten sonra yazılır, gerçek kullanıcı verisi toplanmadan önce yayınlanmış olmalı."
İçerik olarak gerekenler (KVKK m.10 aydınlatma yükümlülüğü çerçevesinde, standart bir SaaS/web
uygulaması için):
- Aydınlatma metni: hangi veri toplanıyor (email, favori listeleri, konum — yalnızca sorgu
  parametresi olarak, NFR-04/ADR 004 gereği hiç saklanmıyor — bu ayrım metinde açıkça belirtilmeli),
  neden, ne kadar süre saklanıyor, üçüncü taraflarla paylaşım var mı (yok — Google Places API'ye
  yalnızca deep-link, veri gönderilmiyor).
- Açık rıza akışı: kayıt formunda checkbox + metne link (kod tarafı — `auth-form.tsx`'e eklenecek).
- Veri saklama/silme politikası: kullanıcı hesabını silerse ne olur (Prisma `User` + bağlı
  `Favorite`/`FavoriteList` kayıtları silinmeli — bugün bir "hesabımı sil" akışı yok, bu da bu
  planın kapsamına girebilir, **açık soru §7'de**).
- Bu metinler hukuki bir belge — ben taslak yazarım, kullanıcı bir hukuk danışmanına onaylatmalı
  (kapsam dışı not, §1).

### 3.4 Pilot metrikleri için event-capture
Prd §5'teki metrikler: "karar eylemi" (Maps'e gitme/kaydetme/paylaşma) oranı, 4. hafta geri dönüş
kohortu. Bunları ölçmek için:
- Hafif bir event-capture katmanı (seçenekler: kendi Postgres tablosu — `AnalyticsEvent`, `CacheStore`
  deseninin aynısı gibi basit bir insert; VEYA üçüncü parti — Plausible/PostHog free tier). **Açık
  karar (§7):** kendi tablo mu, üçüncü parti mi — ikisinin de maliyet/gizlilik/hız takası var,
  `idea-red-team`'e sorulacak.
- Olay noktaları: "Maps'e git" tıklaması (`venue-detail.tsx`'teki deep-link), "favorile" tıklaması
  (zaten var olan `favorite-button.tsx`), "paylaş" tıklaması (`whatsapp-share-button.tsx` +
  Task 4c'nin platform share sheet fix'i).
- **NFR-04 ile çakışma riski YOK** — bu event'ler konum koordinatı taşımıyor, yalnızca "hangi mekan,
  hangi eylem, hangi anonim/kullanıcı-id, ne zaman" — ama bu da KVKK aydınlatma metnine (§3.3)
  girmeli ("kullanım istatistikleri" olarak).
- 4. hafta geri dönüş kohortu: kullanıcının ilk oturumundan 4 hafta sonraki bir dönüşü tespit etmek
  için `User.createdAt` + event tablosundaki en son event arasında bir sorgu — ayrı bir cron/rapor
  gerektirir (admin panelde basit bir sayfa, `data-quality` raporuna benzer).

## 4. Önerilen sıralama (fazlar, bağımlılıklara göre)

```
Faz A (paralel, bağımsız): KVKK metni taslağı + event-capture kod/şema (analytics tablosu, event
  noktaları, admin raporu) — ikisi de gerçek Supabase projesi gerektirmez, lokal/test ortamında
  yazılabilir.
Faz B (gerçek hesap açma — KULLANICI ONAYI GEREKİR): Supabase/Railway/Vercel/Cloudflare provisioning.
Faz C (Faz B'ye bağımlı): Auth sync hook (gerçek Supabase Dashboard'da kurulur), TRUST_PROXY_HOPS
  gerçek değeri, migration deploy, gerçek env değişkenleri.
Faz D (Faz A + Faz C'ye bağımlı): KVKK metni YAYINA ALINIR (gerçek prod'da), event-capture
  gerçek trafiğe açılır — bu sıra KVKK'nın kendi kuralı gereği ZORUNLU (önce metin, sonra veri).
Faz E: Gerçek smoke test + pilot başlangıcı (kullanıcı onayı — pilotun kendisi bir iş kararı).
```

## 5. Test stratejisi

- Faz A (KVKK metni, event-capture kodu): normal TDD — event-capture'ın kendi unit/integration
  testleri (gerçek Postgres'e karşı, mevcut `*.repository.ts` deseniyle), KVKK metni için "test"
  yok (doküman), ama self-review + varsa hukuki gözden geçirme.
  metni.
- Faz B/C (provisioning): kod değişikliği yok, bu yüzden `subagent-driven-development`'ın
  TDD döngüsü uygulanmaz — bunlar **manuel, kullanıcı-onaylı, adım adım runbook** olarak
  yazılacak (bir "task" değil, bir "checklist"). Bu, planın geri kalanından FARKLI bir yürütme
  şekli gerektiriyor — `idea-red-team`'e sorulacak açık nokta (§7).
- Faz D/E: gerçek prod ortamına karşı smoke test (Plan 4a'nın kurduğu deseni genişleterek).

## 6. Riskler / kabul edilen bedeller (taslak, ADR'ye dönüşebilir)

- Event-capture'ı kendi tablomuzda tutmak vs üçüncü parti: kendi tablomuz KVKK'yı en çok kontrol
  altında tutar (veri hiç üçüncü tarafa gitmez) ama basit bir kohort/funnel analizini elle SQL
  yazarak yapmak demek — üçüncü parti (Plausible gibi, KVKK-uyumlu/AB tabanlı) hazır dashboard
  verir ama veri üçüncü tarafa gider (KVKK aydınlatma metnine ek madde gerektirir).
- Custom access token hook'un TAM olarak nasıl kurulacağı (Supabase'in güncel dokümantasyonuna
  bağlı, versiyon değişebilir) — bu tasarım dokümanı hook'un VAR OLMASI gerektiğini ve NE
  yapması gerektiğini tanımlıyor, ama gerçek kurulum adımları writing-plans aşamasında güncel
  Supabase dokümantasyonu okunarak yazılmalı (varsayımla yazılmayacak — Plan 4b/4c'nin "iddia
  edilen mevcut davranışı kodda doğrula" dersi burada da geçerli, sadece kod yerine dış
  dokümantasyon için).

## 7. Açık varsayımlar / kullanıcı onayı gereken noktalar

Bunlar benim (Sonnet) tek başıma karar veremeyeceğim, kullanıcının onaylaması/düzeltmesi gereken
noktalar — `idea-red-team`'e gitmeden önce kullanıcı gözden geçirmeli:

1. **Event-capture: kendi tablo mu, üçüncü parti araç mı?** Öneri kendi tablo (KVKK kontrolü daha
   kolay) ama kullanıcı tercihini bilmiyorum.
2. **"Hesabımı sil" akışı bu plana mı girsin, Faz 2'ye mi ertelensin?** KVKK'nın kendi çerçevesi
   silme hakkını gerektirir ama pilot ölçeğinde (150 kullanıcı, 6 hafta) manuel/admin-tetikli bir
   silme süreci de savunulabilir olabilir — kullanıcı kararı.
3. **Provisioning + KVKK + event-capture gerçekten TEK plan mı olmalı, yoksa 2-3 ayrı plana mı
   (4d/4e/4f) bölünmeli?** §2'de gerekçelendirdim ama bu `idea-red-team`'e sorulacak, kullanıcı da
   kendi tercihini söyleyebilir.
4. **KVKK metinlerinin hukuki onayı** — ben taslak yazarım ama bir avukata gösterilmesi planın
   kapsamında mı, yoksa kullanıcı bunu ayrıca mı hallediyor?
5. **Gerçek hesap açma/ödeme (Faz B)** — hangi ay/bütçe bilgisiyle, kullanıcının kendi kartıyla mı,
   ne zaman yapılacağı tamamen kullanıcı kararı; bu tasarım yalnızca NELERİN açılması gerektiğini
   listeliyor, NE ZAMAN'ı değil.

## 8. Sıradaki adım

Bu taslak `idea-red-team`'e gönderilecek (Codex kotası dönünce, 2026-08-01 23:26 sonrası) —
özellikle §2'nin bölünme sorusu, §7'nin 5 açık noktası, ve §3'teki her bileşenin gerçekten doğru
sırada/bağımlılıkta olup olmadığı sorulacak. Kullanıcı bu taslağı önce kendisi gözden geçirmeli;
red-team'e gitmeden değişiklik isteyebilir.
