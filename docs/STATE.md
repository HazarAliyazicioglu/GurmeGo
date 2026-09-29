# Durum — 2026-09-29 (10. tur)

## Veri sınırı
Codex: izinli, kota aktif. GLM: izinli. TypeSafe (typesafe-ai skill) kuruldu ama **hiçbir gerçek veri akışına bağlanmadı** — kullanılırsa (ör. semantic search) ayrı bir mimari karar+onay gerekir.

## Aktif plan
**Yetki:** A-Z, kapanış sorusu sormadan ilerle.

## Şu an ne yapıyoruz
**PR #52 merge edildi (f8ff02a).** Railway'de `SUPABASE_JWT_ISSUER`/`AUDIENCE` kullanıcı tarafından doğrulandı (zaten set), CI yeşildi, squash merge yapıldı, branch silindi. 9. turun A-Z denetiminden bu yana toplam 10 PR shipped (#53-62 + #52).

**Kod tabanında bağımsız, güvenli iş tükendi.** Kalan her şey kullanıcı kararı/girdisi gerektiriyor — aşağıya bkz.

## Sıradaki adım
Kullanıcıya sor: hangi backlog maddesiyle devam edilsin (aşağıdaki 8 madde), yoksa deploy sonrası `/health` + gerçek login doğrulaması mı öncelik.

**Deploy doğrulaması (PR #52 sonrası, henüz yapılmadı):**
- Railway'de yeni deploy `/health` 200 dönüyor mu?
- Gerçek bir login akışı hâlâ çalışıyor mu (JWT issuer/audience claim kontrolü artık aktif)?

**Kullanıcı kararı gereken backlog (öncelik sırası değişmedi):**
1. **i18n** (BLOCKER, turist persona) — hangi diller, çeviri kalitesi/maliyeti kullanıcı kararı; büyük mimari iş, kendi brainstorming+plan turu gerekir.
2. **KVKK: aydınlatma/açık rıza ayrımı** (KVKK Kurulu 2026/347) — checkbox (#54) iyileştirme ama yeterli değil, gerçek hukuki görüş gerekiyor.
3. **Consent kaydının persist edilmesi** — mevcut audit_log (ADR 006) bilerek KULLANILMADI: o tablo admin hesap verebilirliği için tasarlandı, PII sınırı (actorId=personel) kullanıcı consent event'i için uygun değil. Ayrı bir tasarım gerekiyor, #2 netleşmeden başlanmayacak.
4. **Mobil tasarım sistemi** — büyük, tasarım yönü kullanıcı kararı.
5. **Web/mobil Sentry** — API tarafı bitti (#60), web (@sentry/nextjs, daha karmaşık kurulum) ve mobil taraf yapılmadı, gerçek DSN yoksa zaten aktif olmuyor — acil değil.
6. **Analytics** — hâlâ yok, talep de yok, dokunmadım.
7. **Gurme Puanı/semantic search Faz 2** — kapsamı açmak kullanıcı kararı.
8. **Gerçek mekan verisi** — kullanıcının kendi verisi gerekiyor.

## Bloke olanlar
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
- Railway CLI'a bu ortamdan interaktif login olunamıyor (`railway login` stdin bekliyor) — env var doğrulaması/set etme her zaman kullanıcıdan istenmeli, kendim deneyip zaman kaybetme.
