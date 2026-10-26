# Durum — 2026-09-29 (11. tur sonu)

## KRİTİK BULGU — 2026-10-05: zod v4 `.partial()` + `.default()` veri kaybı, CANLI (master)
Haftalık #18/#24 Dependabot kontrolü sırasında ortaya çıktı, kontrol kapsamının dışında ama
**acil**: idea-red-team'in #24'e (dependabot zod bump) verdiği NO-GO gerekçesi (`.partial()`
türetilen şemalarda zod v4'ün `.default()` alanlarını sessizce output'a enjekte etmesi) PR #24
hiç merge edilmediği halde **#67 ("zod 3.25.76 -> 4.6.5, migrated") ile zaten production'da**.
#67'nin diff'i `packages/shared/src/schemas/admin-venue.schema.ts`'e hiç dokunmamış — sorun kod
değişikliğinden değil, salt zod sürüm bump'ının runtime davranışı sessizce değiştirmesinden.

Ampirik doğrulandı (iki izole `npm install`, aynı kod, sadece zod sürümü farklı):
```
AdminVenueUpdateSchema = AdminVenueCreateSchema.partial()   // signatureItems: z.array(...).default([])
.safeParse({ status: "ARCHIVED" })
  zod 3.25.76 (önceki): { status: "ARCHIVED" }                       // signatureItems yok — güvenli
  zod 4.6.5   (şu an master'da): { status: "ARCHIVED", signatureItems: [] }  // enjekte edildi
```
`ZodValidationPipe.transform()` (`apps/api/src/common/zod-validation.pipe.ts`) `safeParse` sonucunun
`.data`'sını döndürüyor → `AdminVenuesService.update()` bunu aynen `venuesRepository.updateWithLocation()`'a
yayıyor (`apps/api/src/admin/venues/admin-venues.service.ts:71`) → repository `signatureItems !== undefined`
kontrolünden geçiyor (artık `[]`, `undefined` değil) → raw SQL `SET "signatureItems" = '{}'` çalışıyor
(`apps/api/src/venues/venues.repository.ts:459`).

**Etki**: `signatureItems` alanını içermeyen HER `PUT /admin/venues/:id` isteği (ör. sadece
`{status:"ARCHIVED"}`), mevcut imza yemeklerini sessizce `[]`'ye sıfırlıyor. #67, 2026-09-29'da
merge edildi — o tarihten sonraki admin venue update'leri etkilenmiş olabilir; `admin-venue.schema.spec.ts`
bu senaryoyu test etmiyor (sadece `status` kabul edildiğini kontrol ediyor, `signatureItems`'ın
output'ta görünüp görünmediğine bakmıyor), CI bu yüzden hiç kırmızı olmadı.

Dokunmadım (fix kapsam dışı + canlı veri etkisi var, kullanıcı kararı gerekli). Önerilen yön:
`AdminVenueUpdateSchema`'yı `AdminVenueCreateSchema.partial()`'dan türetmek yerine, `signatureItems`'ın
`.default([])`'unu base şemadan çıkarıp sadece Create tarafında eklemek (örn. `.omit({signatureItems:true}).partial().extend({signatureItems: z.array(...).max(10).optional()})`),
ARDINDAN `admin-venue.schema.spec.ts`'e "update without signatureItems does NOT include it in output"
regresyon testi eklemek. Olası mevcut veri kaybını (2026-09-29'dan beri yapılmış update'ler) tespit
etmek DB erişimi gerektiriyor (Docker Desktop kapalı — bkz. Bloke olanlar).

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
- Yukarıdaki KRİTİK BULGU: olası geçmiş veri kaybını tespit etmek DB erişimi gerektiriyor.

## Haftalık Dependabot kontrolü — 2026-10-05 (#18, #24)
İkisi de artık **closed** (merge edilmemiş) — dependabot'un kendisi kapatmış, elle dokunmadım:
- **#18** (fastify minor-and-patch, 24 update): `npm view` ile `@fastify/helmet@13.1.1`,
  `@fastify/compress@9.2.0`, `@fastify/multipart@10.1.2` güncel sürümler olarak doğrulandı — ve
  `apps/api/package.json`'da zaten tam bu sürümler kurulu (git log: helmet/compress ilk commit'ten
  beri, multipart #68 ile). PR #18 branch'i `mergeable_state: dirty` — master zaten onu geçmiş,
  checkout/typecheck/test/build çalıştırmaya değmedi. Aksiyon yok.
- **#24** (zod v3→v4 dependabot bump): closed, çünkü manuel migrasyon (#67) zaten aynı hedefe
  (zod 4.6.5) ulaştı ve merge edildi — tüm paketlerde `zod: ^4.6.5`. `.partial()`+`.default()`
  davranışı hâlâ aynı (bkz. yukarıdaki KRİTİK BULGU) ama PR #24'ün kendisi artık mevcut değil,
  üzerinde aksiyon alınacak bir şey yok.

Backlog'dan düşürüldü: #18/#24 artık "bloklu" değil, ikisi de kapalı ve ilgili bağımlılıklar
başka PR'larla zaten güncellendi. Haftalık kontrol rutini bir sonraki çalışmada bu ikisini
artık aramasın — gerçek konu artık yukarıdaki KRİTİK BULGU.

### 2026-10-12 tekrar kontrol
GitHub API ile doğrulandı: PR #18 ve #24 hâlâ `state: closed`, `merged: false` — 2026-10-05'ten
beri değişiklik yok, elle dokunulmadı. `npm view` ile daha yeni patch sürümleri çıktığı görüldü
(`@fastify/helmet@13.1.2`, `@fastify/compress@9.2.1`, `@fastify/multipart@10.1.3`, `zod@4.6.6`)
ama bunlar kapalı #18/#24'ü etkilemiyor — `apps/api/package.json`'daki caret range'ler (`^13.1.1`,
`^9.2.0`, `^10.1.2`, `^4.6.5`) zaten bu yeni patch'leri kapsıyor, yeni bir dependabot PR'ı açılırsa
o ayrı ele alınır. Aksiyon yok.

Not: Bu haftalık rutinin saklı prompt'u hâlâ #18/#24'ü eski (artık geçersiz) bloklanma
gerekçeleriyle kontrol ediyor — 2026-10-05 notu zaten "bir sonraki çalışmada bu ikisini artık
aramasın" demişti. Rutin tanımını (trig_01EmTq2Gm49KADsXUcLM6zGC) güncellemek veya kapatmak
kullanıcı kararı; dokunmadım.

### 2026-10-19 tekrar kontrol
GitHub API ile doğrulandı: PR #18 ve #24 hâlâ `state: closed`, `merged: false` —
2026-10-12'den beri değişiklik yok, elle dokunulmadı (PR #18: `mergeable_state: dirty`,
branch `dependabot/npm_and_yarn/minor-and-patch-e09db72b12`; PR #24: branch
`dependabot/npm_and_yarn/zod-4.6.5`, ikisi de `master`'a karşı). `npm view` ile daha da
yeni patch sürümleri çıktığı görüldü — `@fastify/helmet@13.2.0`, `@fastify/compress@9.2.2`,
`@fastify/multipart@10.1.4`, `zod@4.6.7` (hepsi 2026-10-18'de yayınlanmış, hemen hemen eşzamanlı)
— ama bunlar da kapalı #18/#24'ü etkilemiyor: `apps/api/package.json`'daki caret range'ler
(`^13.1.1`, `^9.2.0`, `^10.1.2`, `^4.6.5`) zaten bu yeni patch'leri kapsıyor. Zod'un
`CHANGELOG`/release notes'unda (npm registry üzerinden, 4.6.6→4.6.7) `.partial()`+`.default()`
enjeksiyon davranışına dair bir fix/not yok — KRİTİK BULGU hâlâ geçerli kabul edildi, dokunulmadı.
Aksiyon yok; rutin tanımı hâlâ güncellenmedi (kullanıcı kararı, yukarıdaki not geçerli).

### 2026-10-26 tekrar kontrol
GitHub API ile doğrulandı: PR #18 ve #24 hâlâ `state: closed`, `merged: false` —
2026-10-19'dan beri değişiklik yok (her ikisinin `updated_at`'i hâlâ 2026-09-29), elle
dokunulmadı. `npm view` ile sürümler tekrar kontrol edildi: `@fastify/helmet@13.2.0` (değişmedi),
`@fastify/compress@9.2.2` (değişmedi), `@fastify/multipart@10.1.6` (10.1.4'ten yeni patch),
`zod@4.6.7` (değişmedi). Yeni multipart patch'i de `apps/api/package.json`'daki caret range'in
(`^10.1.2`) kapsamında, working tree zaten temiz — çalışma dizininde değişiklik yapılmadı.
KRİTİK BULGU (zod `.partial()`+`.default()` enjeksiyonu) hâlâ geçerli kabul edildi, zod'un
4.6.6→4.6.7 release notlarında ilgili bir fix yok. Aksiyon yok; rutin tanımı hâlâ güncellenmedi
(kullanıcı kararı, 2026-10-05 notu geçerliliğini sürdürüyor).

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
