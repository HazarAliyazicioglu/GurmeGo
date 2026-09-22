# Tasarım Sistemi / Marka Kimliği — Design Doc

**Tarih:** 2026-09-22
**Durum:** İKİ tur cross-model bulgusundan geçti: idea-red-team (Codex, yüksek efor, NO-GO →
kapsam daraltıldı) + implementasyon sonrası cross-model-review (Codex, yüksek efor → next/image
kısmı tamamen geri alındı, bir WCAG hover bug'ı düzeltildi). Nihai teslim edilen kapsam
aşağıdadır; `next/image` GERÇEKLEŞMEDİ (gerekçe aşağıda).
**Kapsam:** Alt proje 1/4 — SADECE web (admin/mobil bu turdan tamamen çıkarıldı, gerekçe aşağıda).

## idea-red-team bulguları (tur 1, Codex, yüksek efor, NO-GO) — hepsi işlendi

- **`unoptimized` next/image hiçbir şeyi optimize etmez** (byte küçülmez, sadece prop değişir):
  KABUL — ilk düzeltme `remotePatterns: [{ hostname: "**" }]`e geçmekti, ama bu da cross-model-review'da
  (tur 2) YENİ bir güvenlik bulgusuyla reddedildi (aşağıya bkz). **Sonuç: next/image bu pakette
  hiç yapılmadı** — ne `unoptimized` (fayda yok) ne `remotePatterns: "**"` (güvenlik riski) kabul
  edilebilir bir seçenekti; mevcut düz `<img loading="lazy">` aynen korundu.
- **Font değişimi (Georgia→Fraunces) gerçek bir görsel değişikliktir, birim test bunu kanıtlamaz**
  (uzun Türkçe mekan adlarının satır kırılımı, kart yüksekliği): KABUL. Unit test iddiası
  kaldırıldı; yerine **elle doğrulama zorunlu** — dev server'da gerçek uzun mekan adlarıyla
  (`docs/prd.md`'deki örnekler) görsel kontrol, ekran görüntüsü.
- **Font eklemenin "performans/gizlilik kazancı" iddiası abartılı** (bugünkü sistem fontu zaten
  0 network isteği): KABUL, gerekçe düzeltildi — bu bir **marka tutarlılığı** kararı, küçük bir
  performans MALİYETİ (bir font dosyası) karşılığında.
- **Mobil tipografiyi açılış akışına bağlamak en riskli parça, tanımsız hata durumu, gerçek cihaz
  doğrulaması yok:** KABUL — mobil ve admin bu turdan **tamamen çıkarıldı**. Admin zaten kendi
  tutarlı nötr paletini kullanıyor, marka kimliği taşımıyor (Codex: "kendi kapsam gerekçesiyle
  çelişiyor" — doğru, admin'e Fraunces yüklemek anlamsız). Mobil ayrı, kendi cihaz doğrulaması
  olan bir görev olarak STATE.md'ye not edilir, bu pakette YOK.
- **Favoriler `@@unique` migration'ı kapsam dışı, ürün kuralı değişikliği, limit-kontrolü sırası
  sorunu var:** KABUL — bu pakete tamamen dahil değil, ayrı bir bounded görev olarak STATE.md'ye
  not edilir.
- **Primitive renk listesi eksik** (`#9e422b`, `#e8e1d5`, `#e67b5e` production kodunda var ama
  listede yok): KABUL — aşağıdaki liste, gerçek `grep` çıktısındaki 14 tonun TAMAMI.
  **Verilen anlamsal isimlendirme fazla iddialı** ("aynı hex farklı roller taşıyabilir, hepsini
  `brand` yapmak yanlış birleşme riski"): KABUL — primitive katman tam, semantic katman
  **minimal** tutuldu (sadece gerçekten tek-anlamlı olanlar isimlendirildi, geri kalanı primitive
  ismiyle kullanılmaya devam eder).
- **WCAG kontrast bulgusu** (terracotta zemin + beyaz metin varsayılan durumda 3.81:1, AA eşiği
  4.5:1 — hesaplandı, doğru): KABUL, YENİ bulgu, düzeltiliyor — `bg-[#d75d3b]` → `bg-[#bd4c30]`
  (4.95:1, AA geçer) varsayılan buton zemini, hover'da `#d75d3b`'ye açılır (ters çevrildi).
  **Tur 2'de bu düzeltmenin kendisi hatalı çıktı — aşağıya bkz.**
- **Leaflet CSS'in component'e taşınması "haritasız sayfa hiç indirmez" garantisi vermez** (Next
  global stylesheet birleştirme davranışı): KABUL, iddia yumuşatıldı — taşınır ama **build
  çıktısıyla doğrulanır** (`next build`'in route bazlı "First Load JS/CSS" raporu), garanti değil
  gözlem olarak yazılır.

## cross-model-review bulguları (tur 2, implementasyon sonrası, Codex, yüksek efor)

- **GÜVENLİK — MAJOR: `remotePatterns: [{ hostname: "**" }]` açık bir görsel proxy'dir.**
  "Sadece admin girdisi" savunması yanlıştı — sorun DB'de hangi URL'nin kayıtlı olması değil,
  **herkesin** `/_next/image?url=<KEYFİ-HTTPS-URL>` çağırabilmesi (admin hesabı gerekmez, hiçbir
  yetkilendirme yok). Next 16.3.5'te yerel-IP erişimi varsayılan kapalı ve yanıt boyutu 50MB'la
  sınırlı olsa da, bu bant genişliği/CPU tüketimi açık bir kaynak-suistimali yüzeyi. KABUL —
  **next/image bu pakette TAMAMEN geri alındı**, mevcut `<img loading="lazy">` korundu. Gerçek
  optimizasyon, bilinen bir domain'e (Supabase Storage gibi) geçişten SONRA, dar bir
  `remotePatterns` ile ayrı bir görev olarak ele alınmalı.
- **WCAG — MAJOR: tur 1'in düzeltmesi hover durumunu AA'nın ALTINA düşürmüş.** Rest state
  `brandSolid` (#bd4c30, 4.95:1) doğruydu ama hover `bg-brand`e (#d75d3b, terracotta, 3.81:1)
  açılıyordu — tam da düzeltilen hatayı hover'da geri getiriyordu. KABUL — hover artık
  `terracottaDeep` (#9e422b, 6.43:1) — hem rest hem hover AA'yı rahatça geçiyor.
- **TDD — MINOR: next/image testi "gerçek optimizasyon" kanıtlamıyordu**, sadece URL biçimini
  kontrol ediyordu (endpoint gerçekten çalışıyor mu, byte küçülüyor mu — jsdom'da ölçülemez).
  KABUL, ama next/image geri alındığı için bu test de kaldırıldı.
- **MINOR: `AdminVenueCreateSchema.photos` `z.string().url()` HTTP'yi de kabul ediyor, ama
  `remotePatterns` sadece HTTPS'e izin veriyordu** — mevcut bir HTTP kaydı optimizer tarafından
  reddedilirdi. next/image geri alındığı için tartışmalı hale geldi, ama not edilir: ileride
  next/image geri gelirse bu uyumsuzluk da çözülmeli.
- **MINOR: doc'taki "font'tan bağımsız çalışır" iddiası yanlış** — satır kırılımı `ch` birimine
  (karakter genişliğine) bağlıdır, farklı fontlar farklı genişliktedir. KABUL — iddia düzeltildi
  (aşağıya bkz), gerçek doğrulama hâlâ ayrı bir görev olarak bekliyor.
- Mekanik rename (17 dosya, ~300 class) spot-check edildi: **TEMİZ**, hiçbir yanlış hex↔isim
  eşlemesi bulunmadı, bildirilen hover bug'ı dışında değer değişikliği yok.
- Kapsam disiplini (sadece web, admin/mobil/favoriler-migration yok, `any` yok, istemci iş
  mantığı yok): **TEMİZ**.

## Neden

`docs/DENETIM-RAPORU.md` §5.3'ün bulduğu gibi, markanın hedeflediği "sıcak, editöryel kimlik"
(docs/product-overview.md) ile kodun görsel durumu arasında fark var. Kod taraması gösteriyor ki
bu fark iddia edildiği kadar büyük değil: web'de zaten tutarlı, kasıtlı bir sıcak palet kullanılıyor
(`#d75d3b` terrakota 88 kez, `#201d18` mürekkep 177 kez, `#f4f0e7` krem 47 kez — 14 farklı ton, rastgele
değil, aile halinde). Gerçek eksik dört yerde:

1. **Token'sızlık:** Renkler her yerde ham hex (`bg-[#f4f0e7]`) — tek bir yerden değiştirilemiyor.
2. **Tipografi hiç yüklenmiyor:** `font-serif`/`font-sans` Tailwind'in jenerik stack'i (Georgia,
   system-ui) — cihaza göre değişiyor.
3. **`next/image` hiç kullanılmıyor** — fotoğraflar gerçekten optimize edilmeden gönderiliyor.
4. **WCAG kontrast bulgusu** (red-team'de bulundu): "Yol tarifi al" butonunun varsayılan
   durumu (`#d75d3b` zemin + beyaz metin) 3.81:1 — AA eşiği 4.5:1'in altında.

## Kapsam

**Dahil:** SADECE web (tüketici, marka kimliğinin göründüğü asıl yer, red-team'in doğruladığı
gibi ölçülebilir bir fayda gösterilebilecek tek yer).

**Kapsam dışı (red-team sonrası):**
- **Admin** — kendi tutarlı nötr paleti zaten var, marka kimliği taşımıyor, dokunulmuyor.
- **Mobil tipografi/renk** — en riskli parça (açılış akışına bağımlılık, tanımsız hata durumu,
  gerçek cihaz doğrulaması gerektirir); ayrı bir görev, STATE.md'ye not edilir.
- **FavoriteList `@@unique` yarış durumu düzeltmesi** — ürün kuralı değişikliği, bu paketle
  ilgisiz; ayrı bir bounded görev, STATE.md'ye not edilir.
- Yeni bir görsel yön/renk paleti icat etmek (YAGNI — mevcut palet zaten iyi çalışıyor).

## Yaklaşım

**Seçilen: web'in mevcut paletini TAM ve doğru kanonikleştir + tek font (başlık) yükle + gerçek
next/image optimizasyonu + kontrast düzeltmesi.**

Alternatif (yeni bir palet/tasarımcı işi baştan tasarlamak) reddedildi: mevcut palet zaten
editöryel/sıcak hissi veriyor; değiştirmek riskli ve gereksiz.

### 1. Renk token'ları (`apps/web/src/lib/colors.ts`)

Gerçek `grep -rohE "#[0-9a-fA-F]{3,8}"` çıktısındaki **14 tonun TAMAMI**, primitive katman —
red-team'in bulduğu eksik liste artık tam:

```ts
export const PRIMITIVE_COLORS = {
  ink: "#201d18", inkSoft: "#2d2923",
  terracotta: "#d75d3b", terracottaDark: "#bd4c30", terracottaDeep: "#9e422b",
  terracottaLight: "#e77959", terracottaSoft: "#e67b5e",
  cream: "#f4f0e7", creamLight: "#faf7f0", creamPale: "#fffdf8",
  sand: "#eadfce", sandLight: "#e8e1d5", sandPale: "#eee5d7",
  brown: "#75402f",
} as const;
```

Semantic katman **minimal** tutuldu (red-team: "aynı hex farklı roller taşıyabilir, hepsini
`brand` yapmak yanlış birleşme riski") — sadece gerçekten tek-anlamlı, kontrast kararı içeren
4 token:

```ts
export const SEMANTIC_COLORS = {
  ink: PRIMITIVE_COLORS.ink,
  surface: PRIMITIVE_COLORS.cream,
  brand: PRIMITIVE_COLORS.terracotta,       // dekoratif kullanım: kenarlık, ikon, odak halkası
  brandSolid: PRIMITIVE_COLORS.terracottaDark, // metin taşıyan dolu zemin (AA kontrast garantili — aşağıya bkz)
} as const;
```

`apps/web/tailwind.config.ts`'nin `theme.extend.colors`'ına yayılır. Mevcut ham hex kullanımları
**mekanik olarak** (GLM'e delege edilebilir, `delegating-bulk-work`) karşılık gelen isimli
class'lara geçirilir — value birebir aynı, sadece isimlendirme; davranış değişikliği yok (test
gerektirmez, saf isim değişimi).

**İstisna — WCAG kontrast düzeltmesi (yeni bulgu, tur 2'de tekrar düzeltildi):** `venue-detail.tsx`'teki
"Yol tarifi al" butonu `bg-[#d75d3b] ... text-white` (varsayılan 3.81:1, AA eşiği 4.5:1'in altında)
→ rest: `bg-brandSolid` (`#bd4c30`, 4.95:1, AA geçer), hover: `hover:bg-terracottaDeep`
(`#9e422b`, 6.43:1, AA rahatça geçer). İlk düzeltme hover'ı `#d75d3b`'ye (3.81:1, AA ALTI) açmıştı
— cross-model-review bunu yakaladı, ikinci düzeltmede hem rest hem hover AA-güvenli.

### 2. Tipografi — SADECE başlık fontu, elle doğrulama zorunlu

**Seçim:** `next/font/google`'dan **Fraunces** (değişken font, tek dosya) — SADECE
`font-serif` (başlıklar). Gövde metni (`font-sans`) bu turda **dokunulmuyor** (red-team: ikinci
bir font = ikinci bir risk yüzeyi, kapsamı büyütmenin gerekçesi yok; sistem sans zaten okunabilir).

`apps/web/src/app/layout.tsx`: `Fraunces` import edilip `--font-serif` CSS değişkeni `<html>`'e
uygulanır; `tailwind.config.ts`'nin `fontFamily.serif`'i bu değişkene bağlanır — mevcut
`font-serif` class kullanımları component değişmeden gerçek fontu alır.

**Elle doğrulama (red-team: birim test bunu kanıtlamaz) — HENÜZ YAPILMADI:** Bu ortamda
Playwright/tarayıcı kurulu değil ve tam yığını (Supabase+API+seed'li DB) ayağa kaldırmak bu
değişikliğin kendisinden daha büyük bir iş olurdu. Doc'un ilk sürümü burada "font'tan bağımsız
çalışır" diye yanlış bir güvence vermişti — cross-model-review (tur 2) haklı olarak düzeltti:
satır kırılımı `ch` birimine (karakter genişliğine) bağlıdır, font değişince değişir. Gerçek
doğrulama (Playwright kurulumu + gerçek uzun Türkçe adlarla ekran testi) **ayrı bir görev**
olarak STATE.md'ye not edilir; bu commit'te font değişikliği düşük-ama-doğrulanmamış bir görsel
riskle teslim ediliyor.

### 3. `next/image` — YAPILMADI (güvenlik bulgusu nedeniyle geri alındı)

İlk tasarım `unoptimized` next/image öneriyordu; idea-red-team bunun hiçbir byte küçültmediğini
gösterdi. Düzeltme olarak `remotePatterns: [{ hostname: "**" }]` denendi (gerçek sunucu-taraflı
yeniden boyutlandırma) — ama cross-model-review (tur 2) bunun **herkesin** `/_next/image?url=<keyfi>`
çağırabildiği açık bir proxy olduğunu gösterdi, admin girdisiyle sınırlı değil. İki seçenek de
(fayda yok / güvenlik riski) kabul edilemezdi. **Sonuç: next/image'a hiç geçilmedi**, mevcut
düz `<img loading="lazy">` aynen korundu. Gerçek optimizasyon, admin'e dosya yükleme eklenip
fotoğraflar bilinen tek bir domain'e (ör. Supabase Storage) taşındıktan SONRA, dar bir
`remotePatterns` ile ayrı bir görev olarak ele alınmalı — STATE.md'ye not edilir.

### 4. Leaflet CSS

`apps/web/src/app/layout.tsx`'teki `import "leaflet/dist/leaflet.css"` silinip
`venue-map-leaflet.tsx`'e taşınır. **İddia yumuşatıldı** (red-team: Next'in global stylesheet
birleştirme davranışı "hiç indirmez" garantisi vermez) — `next build`'in route bazlı "First Load
JS/CSS" raporuyla gerçek fark gözlemlenir, garanti olarak değil gözlem olarak yazılır.

## Test stratejisi

- Renk isim geçişi: mekanik, davranış değişikliği yok, test gerektirmez (build+lint yeterli);
  cross-model-review'da 17 dosyalık rename spot-check edildi, TEMİZ.
- Kontrast düzeltmesi (rest+hover, `bg-brandSolid`/`hover:bg-terracottaDeep`): TDD —
  `venue-detail.spec.tsx`'e her iki durumun da AA-güvenli tonu taşıdığını VE başarısız tonların
  (`bg-terracotta`/`bg-brand`) hiçbir durumda kullanılmadığını doğrulayan test, RED→GREEN
  (tur 2'nin yakaladığı hover regresyonu tekrar olmasın diye ikisi de ayrı ayrı assert edilir).
- Font: elle doğrulama HENÜZ YAPILMADI (yukarıya bkz, dürüstçe not edildi) + mevcut
  `venue-card.spec.tsx`/`venue-detail.spec.tsx`'in kırılmadığı TDD'de doğrulanır.
- `next/image`: YAPILMADI, dolayısıyla test yok — mevcut `<img>` testleri değişmeden kaldı.
- Leaflet CSS taşıma: davranışsal fark yok, test gerekmiyor; build çıktısı elle gözlemlenip
  gerçek izolasyon kanıtlandı (aşağıya bkz).

## Kapsam dışı bırakılan, STATE.md'ye not edilecek ayrı görevler
- Mobil renk/font tutarlılığı (RN, kendi cihaz doğrulaması gerektirir).
- `FavoriteList` aynı-isim yarış durumu (`@@unique([userId, name])`) — ürün kuralı değişikliği.
- `next/image` gerçek optimizasyonu — admin'e dosya yükleme + bilinen tek domain'den SONRA.
- Fraunces'ın gerçek uzun Türkçe mekan adlarıyla Playwright doğrulaması.

## Uygulama sonrası doğrulama — dürüst durum

Bu ortamda (Playwright/tarayıcı kurulu değil, tam yığın — Supabase+API+seed'li DB — ayağa
kaldırmak bu değişikliğin kendisinden daha büyük bir iş olurdu) **gerçek tarayıcıda görsel
doğrulama yapılamadı.** Bunun yerine yapılan, daha zayıf ama gerçek kanıtlar:

- `next build` gerçekten çalıştırıldı (mock değil): Fraunces derlendi, tip hatası yok.
- Leaflet CSS izolasyonu **build çıktısından dosya seviyesinde doğrulandı**: `.next/static/chunks/`
  altında leaflet stilleri ayrı bir 10KB chunk'ta, ve `favoriler.html`/`giris.html`/`index.html`
  prerender çıktılarının hiçbirinde bu chunk'a referans yok (`grep -c` ile sayıldı, 0). Bu, gerçek
  build çıktısı üzerinden dosya-seviyesinde doğrulandı (cross-model-review'ın workspace'inde
  `.next` bulunmadığı için kendisi yeniden üretemedi, ama yöntem tarif edilen şekilde geçerli).
- `next/image` **hiç yapılmadı** (yukarıya bkz) — bu maddeye artık gerek yok.
- Font/uzun-isim satır kırılımı **doğrulanamadı** — ilk sürümdeki "font'tan bağımsız" iddiası
  YANLIŞTI (cross-model-review düzeltti: `ch` birimi font metriğine bağlıdır), düzeltildi. Bu,
  düşük-ama-doğrulanmamış bir görsel risk olarak teslim ediliyor.
