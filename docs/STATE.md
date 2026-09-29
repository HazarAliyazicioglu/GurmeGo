# Durum — 2026-09-29 (11. tur)

## Veri sınırı
Codex: izinli, kota zaman zaman doluyor (saatlik reset, ör. bugün 15:36 ve 20:37). GLM: izinli.
**2026-09-29: kullanıcı çapraz-model review'ı ZORUNLULUKTAN ÖNERİYE indirdi** — artık sadece
kritik anlarda (güvenlik/auth/ödeme, geri dönüşü zor veri değişikliği, yeni dış entegrasyon,
merge öncesi büyük kilometre taşı) tek cümlelik öneri olarak sun, ısrar etme. idea-red-team ve
plan-red-team hâlâ ZORUNLU, değişmedi.

## Aktif plan
**Yetki:** A-Z, kapanış sorusu sormadan ilerle.
`docs/superpowers/specs/2026-09-29-web-i18n-infra-design.md` yazıldı — next-intl, TR+EN, URL
çevirisi dahil, sadece web+altyapı (mobil/veri çevirisi kapsam dışı). **idea-red-team bekliyor**
(Codex kotası dolu, 20:37'de tekrar denenecek) — bu adım atlanamaz, writing-plans başlayamaz.

## Şu an ne yapıyoruz
**Bu turda 4 PR merge edildi:** #65 (web+mobil Sentry, no-op DSN'siz, NFR-04 scrub — cross-model
review'da 1 BLOCKER/birkaç MAJOR bulundu ve düzeltildi), #66 (dependabot'un react-native/react
bump'ı Expo SDK 57 uyumsuzluğu yaratmıştı, düzeltilip merge edildi, dependabot.yml'e ignore
eklendi), #67 (zod 3→4, errorMap→error + .pipe() değişikliği + 3 test fixture'ında RFC-uyumsuz
sahte UUID düzeltmesi), #77 (jose 6.x saf ESM, jest.config.js'e @nestjs/* ile aynı desen eklendi).

Ayrıca dependabot'un zod/jose kapanışı tetiklediği 9 yeni major-bump PR'ı (#68-76) triyaj edildi:
7'si CI yeşildi, sırayla merge ediliyor (#68,70,76 tamam; #71,72,74,75 rebase bekliyor —
birbirleriyle lockfile çakışıyor, `@dependabot rebase` ile çözülüyor). **#73 (vitest 1.6.1→5.0.2,
4 major atlıyor) kasıtlı ERTELENDİ** — `global` tip hatasıyla başlıyor, muhtemelen config/coverage
API'lerinde de kırılma var, kendi ayrı turunu hak ediyor.

## Sıradaki adım
1. #71/72/74/75'in rebase'i bitince merge et (dependabot dev-dependency major'ları, hepsi CI yeşil).
2. Codex 20:37'de açılınca: i18n spec'inin idea-red-team'i → sonra writing-plans.
3. #73 (vitest major migration) için ayrı bir tur — kapsamı `packages/api-client` + muhtemelen
   web/admin/shared'ın vitest.config.ts'leri, tek dosyalık jose fix'inden çok daha büyük.
4. Kullanıcı kararı gereken backlog (değişmedi): KVKK aydınlatma/rıza ayrımı, consent persist
   tasarımı, mobil tasarım sistemi, analytics, Gurme Puanı/semantic search Faz 2, gerçek mekan
   verisi.

## Bloke olanlar
- i18n red-team (Codex kotası, 20:37).
- #71/72/74/75 (dependabot rebase bekliyor).
- Docker Desktop bu ortamda kapalı — apps/api'nin DB'li testleri yalnızca CI'da doğrulanabiliyor,
  kendim başlatmadım (bellek baskısı riski, oturum başında arka plan işler bu yüzden öldürüldü).

## Yakın kararlar
- ADR 006 (audit log, consent için kullanılmamalı) · ADR 005 (native mobile).

## Denenmiş ve ELENMİŞ yaklaşımlar (KALICI dersler)
- Dependabot'un `minor-and-patch` grubu Expo-yönetimli paketleri (react-native/react vb.) SDK'nın
  pinlediği versiyonun DIŞINA bump'layabilir → `dependabot.yml`'e ignore eklendi, gelecekte
  `expo install --fix` ile elle yapılmalı.
- Büyük Codex prompt'unu (diff dahil) komut satırı argümanı olarak vermek Windows'ta
  "Argument list too long" ile sessizce ölüyor → her zaman dosyaya yaz, stdin'den ver.
- Git worktree'de lockfile conflict çözerken `git add` SIRASI önemli: `pnpm install`'dan ÖNCE
  add edersen stale içerik commit'lenir — önce install, sonra add.
- Birden fazla bağımsız dependabot PR'ını sırayla merge ederken her merge sonrası kalanlar
  lockfile'da çakışır → `@dependabot rebase` yorumuyla otomatik çözdür, elle worktree cerrahisi
  yapma (yalnızca kendi branch'lerim için worktree gerekiyor).
- next-intl + Next.js `instrumentation.ts` kök dizinde mi `src/` altında mı tartışması: ikisi de
  çalışır (Next.js her ikisini de arar) — build çıktısını (`.next/server/instrumentation.js`)
  okuyarak DOĞRULA, Codex'in konum iddiasına körü körüne güvenme.
