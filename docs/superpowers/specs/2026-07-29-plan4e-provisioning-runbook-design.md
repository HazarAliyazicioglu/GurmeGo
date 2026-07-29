# Plan 4e — Provisioning + Auth-Sync + Go-Live Runbook — Design

**Tarih:** 2026-07-29 · **Durum:** Taslak — `idea-red-team` (Codex) henüz çalıştırılmadı, kota
2026-08-01 23:26'ya kadar dolu.

İlgili: [infrastructure.md](../../infrastructure.md) ·
[2026-07-29-infra-launch-design.md](2026-07-29-infra-launch-design.md) (orijinal taslak, bölünme
gerekçesi) · [2026-07-29-plan4d-kvkk-analytics-design.md](2026-07-29-plan4d-kvkk-analytics-design.md)
(bağımlı plan)

## 1. Neden ayrı plan (Plan 4d'den farklı yürütme şekli)

Bu plan **kod üretmiyor** (birkaç küçük env-değeri/config değişikliği hariç) — gerçek hesap açma,
ödeme bilgisi girme, DNS kaydı, Supabase Dashboard'da manuel kurulum gibi adımlardan oluşuyor.
`subagent-driven-development`'ın "implementer subagent → task-reviewer → diff review" döngüsü bu
işe uymuyor: bir "Supabase hesabı aç" adımının review edilecek bir diff'i yok. Bu yüzden bu plan
klasik bir task listesi değil, **adım adım bir runbook** — her adımda ben talimat veririm, SEN
uygularsın (hesap açma/ödeme senin kararın/kartın), ben doğrularım (health check, smoke test).

**Genel kural (proje standart kuralı, burada özellikle geçerli):** Gerçek para harcayan veya geri
dönüşü zor her adım (yeni bir hesap açmak, ücretli bir plana geçmek, bir domain satın almak)
öncesinde açıkça durup senin onayını alacağım — sessizce ilerlemeyeceğim.

## 2. Kapsam

1. Supabase production projesi açma + migration deploy.
2. Railway'de API servisi açma + env değişkenleri.
3. Vercel'de web + admin (ayrı proje) açma + env değişkenleri.
4. Cloudflare DNS kaydı.
5. Supabase Custom Access Token Hook kurulumu (Auth↔Prisma `User` senkronizasyonu).
6. Gerçek `TRUST_PROXY_HOPS`/`CORS_ORIGIN`/`SUPABASE_JWT_ISSUER`+`AUDIENCE` değerlerinin
   belirlenmesi (varsayımla değil, gerçek platform dokümantasyonu okunarak).
7. Gerçek prod ortamına karşı smoke test.
8. (Plan 4d bitince) KVKK metnini gerçek prod'da yayına alma + event-capture'ı gerçek trafiğe açma.

**Kapsam DIŞI:** Bu planın KODU yok — Plan 1-4c + Task 17-26'nın kodu zaten hazır ve test edilmiş;
bu plan onu ÇALIŞTIRACAK gerçek ortamı kurmakla sınırlı. Plan 4a'nın bilinçli kararı (native
git-push deploy, kurumsal CI/CD koreografisi yok) burada da geçerli — bu plan o kararı genişletmiyor.

## 3. Adımlar (taslak sıralama — `idea-red-team`, gerçek platform dokümantasyonuyla doğrulanmalı)

### Adım 1 — Supabase production projesi
- **DURAKLAMA NOKTASI:** Yeni Supabase projesi açmak (ücretsiz katmanda başlar, büyüyünce Pro
  $25/ay). Senin onayınla açılır.
- `prisma migrate deploy` ile tüm migration'lar gerçek DB'ye uygulanır.
- PostGIS/pgvector/pg_trgm extension'ları etkinleştirilir (migration ile, `infrastructure.md §3`).

### Adım 2 — Railway API servisi
- **DURAKLAMA NOKTASI:** Railway hesabı/servis açmak (Hobby ~$5/ay).
- `.env.example`'daki TÜM değişkenler gerçek değerleriyle girilir — özellikle Task 17-26'nın
  eklediği yeni zorunlu değişkenler (`RULES_BOUTIQUE_MAX_BRANCHES`, `RULES_STALE_DAYS`,
  `RULES_MOD_AUTO_HIDE_REPORTS`, `RATE_LIMIT_*`, `RATE_LIMIT_CLEANUP_RETENTION_MINUTES`,
  `TRUST_PROXY_HOPS`, `SUPABASE_JWT_ISSUER`/`AUDIENCE`) — bunlar olmadan apps/api artık boot-time
  hata verir (Task 20'nin bilinçli kararı), yani bu adım eksiksiz olmalı.
- Gerçek `TRUST_PROXY_HOPS` değeri: Railway'in reverse-proxy topolojisi gerçek Railway
  dokümantasyonundan doğrulanmalı (varsayımla "1" yazılmayacak).

### Adım 3 — Vercel (web + admin)
- **DURAKLAMA NOKTASI:** Vercel projesi açmak (ücretsiz katman muhtemelen yeterli, MVP ölçeğinde).
- İki ayrı proje (web, admin) — admin'e erişim kısıtlaması (Vercel'in kendi auth/IP-allowlist
  özelliği veya mevcut Supabase Auth rol kontrolü — hangisi, `idea-red-team`'e sorulacak).
- `NEXT_PUBLIC_API_URL` gibi env değişkenleri Railway'in gerçek URL'ine bağlanır.

### Adım 4 — Cloudflare DNS
- **DURAKLAMA NOKTASI:** Domain zaten var mı, yoksa yeni satın alınacak mı — bu tamamen senin
  kararın, bu tasarım dokümanı varsaymıyor.
- DNS kaydı + Cloudflare önü (CDN, `infrastructure.md §1`).

### Adım 5 — Auth-sync hook
- Supabase Dashboard'da (veya migration ile) bir Postgres trigger/fonksiyon: `auth.users`'a yeni
  kayıt düşünce Prisma `User` tablosuna otomatik satır eklenir.
- JWT `user_role` claim'i gerçek DB rolünden üretilecek şekilde yapılandırılır — Task 17'nin
  düzelttiği lowercase normalizasyonunun gerçek production'da ilk kez test edildiği an burası.
- **Gerçek kurulum adımları writing-plans aşamasında güncel Supabase dokümantasyonu okunarak
  yazılacak** — Supabase'in hook mekanizması sürüm bazında değişebilir, burada varsayımla
  yazılmıyor.

### Adım 6 — Gerçek smoke test
- Plan 4a'nın kurduğu smoke-test deseni (`.github/workflows/ci.yml`), gerçek prod URL'ine karşı
  genişletilir: `/health`, gerçek bir curator JWT ile admin uçlarına örnek istek (Plan 4b Task
  16'da otomatik ortamda atlanmış olan manuel adım — burada gerçek ortamda ilk kez yapılabilir).

### Adım 7 — Go-live (Plan 4d bitince)
- KVKK metni gerçek prod domain'inde yayına alınır.
- Event-capture gerçek trafiğe açılır.
- Pilot başlangıcı — **bu bir iş kararı, kod/altyapı hazır olsa bile ne zaman başlayacağı
  tamamen senin kararın.**

## 4. Test/doğrulama stratejisi

- Her adımdan sonra somut bir doğrulama var (health check, gerçek bir HTTP isteği, Supabase
  Dashboard'da görünür bir kayıt) — "adım tamamlandı" asla varsayımla işaretlenmez.
- Kod değişikliği gerektiren tek kısımlar (gerçek env değerlerinin `.env.example`'a değil gerçek
  platform secret yönetimine girilmesi — kod değil, config) test gerektirmiyor, ama her birinin
  DOĞRU girildiği bir sonraki adımın health-check'iyle dolaylı doğrulanıyor.

## 5. Riskler

- Bu plan gerçek para harcıyor (Supabase Pro'ya geçiş ihtimali, Railway Hobby, muhtemel domain
  satın alma) — bütçe hedefi `infrastructure.md`'de $0-50/ay olarak belirlenmiş, gerçek faturalar
  bu aralıkta kalmalı, aşarsa durup sorulacak.
- Auth-sync hook'un TAM doğru kurulmaması durumunda (Task 17'nin role-case fix'i ilk kez gerçek
  veriyle test edileceği için) sessiz bir yetkilendirme hatası riski var — bu yüzden Adım 5'ten
  sonra Adım 6'nın smoke test'i özellikle curator/admin rolüyle bir istek içermeli, yalnızca
  `/health` yeterli değil.

## 6. Açık sorular (kullanıcı onayı gerekiyor, `idea-red-team`'den önce)

1. **Bütçe/zamanlama:** Adım 1-4'teki hesap açma işlemleri ne zaman yapılacak (Plan 4d bitince mi,
   paralel mi)? Hangi kartla/hesapla?
2. **Domain:** Zaten sahip olunan bir domain var mı, yoksa Adım 4 yeni bir satın alma mı
   gerektiriyor?
3. **Admin paneli erişim kısıtlaması:** Vercel'in kendi erişim kontrolü mü, yoksa yalnızca
   Supabase Auth rol kontrolüne mi güvenilecek (bugünkü kod zaten `RolesGuard` ile koruyor —
   ekstra bir platform-seviyesi kısıtlama gerçekten gerekli mi, yoksa gereksiz bir katman mı)?
