# Durum — 2026-09-28 (9. tur)

## Veri sınırı
Codex: izinli, kota aktif. GLM: izinli. TypeSafe (typesafe-ai skill) kuruldu ama **hiçbir gerçek veri akışına bağlanmadı** — kullanılırsa (ör. semantic search) ayrı bir mimari karar+onay gerekir.

## Aktif plan
**Yetki:** A-Z, kapanış sorusu sormadan ilerle. Bugün ilk kez gerçek bir "hard-to-reverse" aksiyonda (JWT prod fail-fast, PR #52) durup kullanıcı onayı istendi — prod outage riski Railway'de doğrulanamadığı için. Gerekçe: STATE.md'nin kendi yetki notu da "gerçek prod erişimi... kullanıcı kendisi yapıyor" diyor.

## Şu an ne yapıyoruz
**Tam kapsamlı A-Z proje denetimi (4 paralel fork: güvenlik/uyum, kullanılabilirlik/persona, gereksinim kapsamı, ulaşılabilirlik/ops) + bulgulara göre 5 PR shipped (#50-51 önceki mesajda, #53-55 bu turda), 1 PR açık bekliyor (#52).**

**Shipped (merge edildi):**
- #53: Railway `healthcheckPath: /health` + Dockerfile `HEALTHCHECK` — Docker'da build+run ile doğrulandı (healthy).
- #54: Web signup'ta pasif link yerine zorunlu onay checkbox'ı (KVKK açık rıza iyileştirmesi) + mode-toggle reset bug fix (cross-model review buldu).
- #55: `prd.md`/`architecture.md` — aylardır stale "mobil Faz 2'de" iddiası ADR 005'e (2026-09-07, kullanıcı bilerek NO-GO'yu reddetti) senkronize edildi, 3 tur cross-model review ile.

**Açık, MERGE EDİLMEDİ — kullanıcı onayı bekliyor:**
- **PR #52 (fix/jwt-prod-fail-fast):** `SUPABASE_JWT_ISSUER`/`AUDIENCE` prod'da unset ise artık fail-fast. CI yeşil, kod/test sağlam (Codex high-effort review'dan geçti). **Ama Railway'de bu iki env var gerçekten set değilse, merge sonrası API hiç açılmaz.** Railway CLI/dashboard erişimim yok, doğrulayamadım. **Merge etmeden önce Railway'de bu ikisini kontrol et/ayarla.**

**Denetimde bulunan ama YANLIŞ ÇIKAN fork bulguları (düzeltme notu, tekrar gündeme getirme):**
- "`/health` yok" → **yanlış**, zaten var (`app.module.ts`), sadece Railway'e bildirilmemişti (şimdi #53 ile düzeltildi).
- "Kullanım Koşulları sayfası yok" → **yanlış**, `apps/web/src/app/kullanim-kosullari` zaten var ve test edilmiş.

**Gerçek, henüz ELE ALINMAMIŞ bulgular (öncelik sırasıyla):**
1. i18n sıfır (BLOCKER, turist persona'sı için) — büyük iş, kapsam konuşulmalı.
2. KVKK: aydınlatma ile açık rıza ayrı tutulmalı (KVKK Kurulu 2026/347) — checkbox iyileştirme yeterli değil, **gerçek hukuki görüş gerekiyor**, ben karar veremem.
3. Consent kaydı persist edilmiyor (audit log'a bağlanabilir, ADR 006 altyapısı var) — ayrı backend işi.
4. Mobil kullanıcı katkı UI'sı web'in gerisinde (`ReportForm.tsx` yalnızca serbest metin, yapısal field/suggestedValue yok, yeni mekan önerisi yok).
5. Mobilde loading spinner eksik (Discovery/Favorites), mobil tasarım sistemi eksik (bilinen, büyük iş).
6. Sentry yok (hatalar sessizce kayboluyor), analytics yok (görünürlük yok ama NFR-04 riski de yok).
7. Gurme Puanı/semantic search Faz 2 kapsamı — kullanıcı kararı.
8. Gerçek mekan verisi (seed placeholder yerine) — kullanıcının kendi verisi gerekiyor.

## Bloke olanlar
- **PR #52 — yukarıya bkz., Railway env var doğrulaması bekliyor.**
- railway.json: Railway'in Config as Code formatı deprecated (2026-12-01'e kadar legacy'de çalışır) — o tarihten önce yeni formata bakılmalı.
- Yerel test DB: `docker run -d --name gurmego-test-pg -e POSTGRES_PASSWORD=postgres -p 5555:5432 postgis/postgis:15-3.4` + `prisma migrate deploy` ile kuruldu, hâlâ ayakta — sonraki oturumda tekrar kurmaya gerek yok.
- Yukarıdaki 8 madde — kod tabanında bağımsız güvenli iş kalmadı, biri seçilmeli veya kullanıcı girdisi gerekiyor.

## Yakın kararlar
- ADR 006: audit log · ADR 005: native mobile (bugün prd.md/architecture.md'ye senkronize edildi, PR #55).

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Railway + Railpack otomatik tespit: ELENDİ → kendi Dockerfile'ını yaz.
- Supabase direct connection IPv6-only → pooler'a geç.
- React Navigation linking config'de `initialRouteName` unutmak: deep-link geri navigasyonunu kırar.
- Native `required` + custom JS validasyon mesajı birlikte: `required` submit event'i engelliyor, custom mesaj hiç görünmüyor — ya `noValidate` ekle ya da yalnızca birini kullan.
- Fork denetim bulgularını doğrulamadan STATE'e yazma: bu turda 2 fork bulgusu (`/health` yok, ToS yok) yanlış çıktı — kodu her zaman kendin oku, "muhtemelen" diyen bulguyu özellikle.
- Codex'in ilk "TEMİZ" veya tek-turlu review'ı yeterli sayma: docs reconciliation'da 3 tur gerekti, her turda gerçek MAJOR çıktı.
