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
