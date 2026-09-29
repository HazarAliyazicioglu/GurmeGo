# Durum — 2026-09-29 (11. tur sonu)

## Veri sınırı
Codex: izinli, kota saatlik reset oluyor. GLM: izinli.
**2026-09-29: kullanıcı çapraz-model review'ı ZORUNLULUKTAN ÖNERİYE indirdi** — artık sadece
kritik anlarda (güvenlik/auth/ödeme, geri dönüşü zor veri değişikliği, yeni dış entegrasyon,
merge öncesi büyük kilometre taşı) tek cümlelik öneri olarak sun, ısrar etme. idea-red-team ve
plan-red-team hâlâ ZORUNLU, değişmedi.

## Aktif plan
Henüz plan yok. `docs/superpowers/specs/2026-09-29-web-i18n-infra-design.md` yazıldı (next-intl,
TR+EN, URL çevirisi dahil, sadece web+altyapı) — **idea-red-team bekliyor** (Codex kotası),
writing-plans o adımdan sonra başlayacak.

## Şu an ne yapıyoruz
11. turda 12 PR merge edildi, master tamamen yeşil (son CI çalışması doğrulandı): web+mobil
Sentry (#65, BLOCKER/MAJOR bulgular düzeltilerek), Expo/RN dependabot uyumsuzluğu (#66), zod v4
migrasyonu (#67), jose v6 ESM fix'i (#77), 7 diğer dependency major bump'ı. Detay: docs/CHANGELOG.md.

## Sıradaki adım
Codex kotası açılınca (saatlik reset) i18n spec'inin `idea-red-team`'ini çalıştır, sonra `writing-plans`'a geç.

## Bloke olanlar
- i18n red-team (Codex kotası).
- Docker Desktop bu makinede kapalı — apps/api'nin DB'li testleri yalnızca CI'da doğrulanabiliyor.

## Yakın kararlar
- ADR 006 (audit log, consent için kullanılmamalı) · ADR 005 (native mobile).

## Denenmiş ve ELENMİŞ yaklaşımlar
- Dependabot'un `minor-and-patch` grubu Expo-yönetimli paketleri SDK pininin dışına bump'layabilir
  → `dependabot.yml`'e ignore eklendi. KALICI.
- Büyük Codex prompt'unu (diff dahil) komut satırı argümanı olarak vermek Windows'ta "Argument
  list too long" ile sessizce ölüyor → dosyaya yaz, stdin'den ver. KALICI (zaten memory'de de var).
- Git worktree'de lockfile conflict çözerken `git add` SIRASI önemli: `pnpm install`'dan ÖNCE
  add edersen stale içerik commit'lenir. KALICI.
- Birden fazla bağımsız dependabot PR'ını sırayla merge ederken her merge sonrası kalanlar
  lockfile'da çakışır → `@dependabot rebase` yorumuyla otomatik çözdür. KALICI.
- next-intl + Next.js `instrumentation.ts` kök/`src/` tartışması: ikisi de çalışır, Codex'in konum
  iddiası yanlış çıktı — build çıktısını (`.next/server/instrumentation.js`) okuyarak DOĞRULA.
- Docker Desktop'ı bu ortamda kendim başlatma — oturum başında bellek baskısı yüzünden arka plan
  işler zaten öldürüldü, GUI app başlatmak riski büyütür. KOŞULLU — kullanıcı isterse başlatsın.

## Bekleyen kullanıcı kararı gereken backlog (değişmedi)
KVKK aydınlatma/rıza ayrımı, consent persist tasarımı, mobil tasarım sistemi, analytics, Gurme
Puanı/semantic search Faz 2, gerçek mekan verisi. Ayrıca: #73 (vitest major migrasyonu, ayrı tur).
