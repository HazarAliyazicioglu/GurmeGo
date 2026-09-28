# Durum — 2026-09-28 (10. tur)

## Veri sınırı
Codex: izinli, kota aktif. GLM: izinli. TypeSafe (typesafe-ai skill) kuruldu ama **hiçbir gerçek veri akışına bağlanmadı** — kullanılırsa (ör. semantic search) ayrı bir mimari karar+onay gerekir.

## Aktif plan
**Yetki:** A-Z, kapanış sorusu sormadan ilerle. İki istisna bu turda uygulandı: (1) Railway prod outage riski (PR #52, doğrulayamadığım env var) — merge edilmedi, kullanıcı onayı bekliyor. (2) TypeSafe skill kurulumu — bilinmeyen 3. parti kaynak olduğu için tek soru soruldu, onay alındı, kuruldu.

## Şu an ne yapıyoruz
**9. turun A-Z denetiminden sonra bulgulara göre 9 PR daha shipped (#53-61), 1 PR açık bekliyor (#52).**

**Shipped (merge edildi, bu turda):**
- #53 healthcheck, #54 KVKK checkbox, #55 docs/ADR005 senkronu (önceki mesajda özetlendi)
- #57: mobil Discovery/Favorites'a loading indicator
- #58: mobil `ReportForm`'a yapısal düzeltme (field/suggestedValue) — web parite
- #59: mobil `SuggestVenueScreen` — web'in `/mekan-oner`'ının mobil karşılığı, hiç yoktu
- #60: API'ye Sentry entegrasyonu — `SENTRY_DSN` yoksa no-op, NFR-04 için header scrub (`beforeSend`)
- #61: infrastructure.md senkronu

**Açık, MERGE EDİLMEDİ — kullanıcı onayı bekliyor:**
- **PR #52 (fix/jwt-prod-fail-fast):** Railway'de `SUPABASE_JWT_ISSUER`/`AUDIENCE` gerçekten set değilse merge API'yi çökertir. Railway CLI'a login olamadım (`railway login` interaktif). **Railway dashboard'dan bu ikisini kontrol et/ayarla, sonra merge et.**

**Her PR'da cross-model review gerçek bulgu buldu** — örnek: docs reconciliation 3 tur gerektirdi, Sentry entegrasyonunda NFR-04 ihlali riski (header scrub yoksa), mobil suggest-venue'de a11y + trim eksikliği. Süreç işliyor.

## Sıradaki adım
**Kod tabanında bağımsız, güvenli iş tükendi. Kalanların hepsi kullanıcı girdisi/kararı gerektiriyor:**
1. **i18n** (BLOCKER, turist persona) — hangi diller, çeviri kalitesi/maliyeti kullanıcı kararı; büyük mimari iş, kendi brainstorming+plan turu gerekir.
2. **KVKK: aydınlatma/açık rıza ayrımı** (KVKK Kurulu 2026/347) — checkbox (#54) iyileştirme ama yeterli değil, gerçek hukuki görüş gerekiyor.
3. **Consent kaydının persist edilmesi** — mevcut audit_log (ADR 006) bilerek KULLANILMADI: o tablo admin hesap verebilirliği için tasarlandı, PII sınırı (actorId=personel) kullanıcı consent event'i için uygun değil. Ayrı bir tasarım gerekiyor, #2 netleşmeden başlanmayacak.
4. **Mobil tasarım sistemi** — büyük, tasarım yönü kullanıcı kararı.
5. **Web/mobil Sentry** — API tarafı bitti (#60), web (@sentry/nextjs, daha karmaşık kurulum) ve mobil taraf yapılmadı, gerçek DSN yoksa zaten aktif olmuyor — acil değil.
6. **Analytics** — hâlâ yok, talep de yok, dokunmadım.
7. **Gurme Puanı/semantic search Faz 2** — kapsamı açmak kullanıcı kararı.
8. **Gerçek mekan verisi** — kullanıcının kendi verisi gerekiyor.

## Bloke olanlar
- **PR #52 — yukarıya bkz.**
- railway.json: Config as Code formatı 2026-12-01'e kadar legacy'de çalışır, o tarihten önce yeni formata bak.
- Yerel test DB hâlâ ayakta: `docker start gurmego-test-pg` (5555 portu) — `docker ps` ile `bayotomotiv-*` konteynerlarıyla karıştırma, onlara dokunma.
- Yukarıdaki 8 madde.

## Yakın kararlar
- ADR 006: audit log (kullanıcı consent event'i için KULLANILMAMALI, yukarı bkz.) · ADR 005: native mobile (prd.md/architecture.md'ye senkronize, PR #55).

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Railway + Railpack otomatik tespit: ELENDİ → kendi Dockerfile'ını yaz.
- Native `required` + custom JS validasyon mesajı birlikte: `required` submit event'i engelliyor, `noValidate` gerekir.
- Fork/review bulgusunu doğrulamadan STATE'e yazma: bu turda da tekrarlandı — kendi eklediğim "kalıntı" notu kendi diff'imle çelişti, Codex 2. turda yakaladı. Her review bulgusunu gerçek kodu okuyarak doğrula, ilk "TEMİZ" cevabına güvenme.
- Sentry gibi hata-izleme SDK'ları pino/log redact'ından TAMAMEN BAĞIMSIZ bir pipe'tır — NFR-04 gibi "hiçbir yere yazılmaz" invariantları her yeni telemetri kanalında ayrıca uygulanmalı, "zaten redact var" varsayımı yanlış.
- Var olan bir audit/log tablosunu amacı dışında (farklı PII sınırı olan) bir iş için yeniden kullanma isteğine direnç göster — ADR'nin PII sınırı kararı bilinçliydi, genişletmek yeni bir ADR/tasarım gerektirir.
