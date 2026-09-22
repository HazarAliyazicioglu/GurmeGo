# Tasarım Sistemi / Marka Kimliği — Design Doc

**Tarih:** 2026-09-22
**Durum:** idea-red-team NO-GO verdi (Codex, yüksek efor) — kapsam ciddi daraltıldı, aşağıdaki
sürüm daraltılmış+düzeltilmiş halidir. Yeniden red-team'e sokulmadı (kapsam artık çok daha küçük
ve her nokta somut bir Codex bulgusuna karşılık düzeltildi; ikinci bir tur orantısız olur).
**Kapsam:** Alt proje 1/4 — SADECE web (admin/mobil bu turdan tamamen çıkarıldı, gerekçe aşağıda).

## Red-team bulguları (Codex, yüksek efor, NO-GO) — hepsi işlendi

- **`unoptimized` next/image hiçbir şeyi optimize etmez** (byte küçülmez, sadece prop değişir):
  KABUL. Yaklaşım değişti — `unoptimized` yerine `remotePatterns: [{ hostname: "**" }]` (gerçek
  sunucu-taraflı yeniden boyutlandırma). Maliyet: admin-girişli keyfi URL'leri sunucu tarafında
  fetch etmek — sadece admin/curator girdisi (herkese açık form değil), MVP için kabul edilebilir
  risk; büyürse allowlist'e daraltılır (ayrı, sonraki karar).
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
- **Leaflet CSS'in component'e taşınması "haritasız sayfa hiç indirmez" garantisi vermez** (Next
  global stylesheet birleştirme davranışı): KABUL, iddia yumuşatıldı — taşınır ama **build
  çıktısıyla doğrulanır** (`next build`'in route bazlı "First Load JS/CSS" raporu), garanti değil
  gözlem olarak yazılır.

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

**İstisna — WCAG kontrast düzeltmesi (yeni bulgu):** `venue-detail.tsx`'teki "Yol tarifi al"
butonu `bg-[#d75d3b] ... text-white` (varsayılan 3.81:1, AA eşiği 4.5:1'in altında) →
`bg-brandSolid` (`#bd4c30`, 4.95:1, AA geçer) + hover `#d75d3b`'ye açılır (mevcut hover/rest
davranışı ters çevrilir — daha koyu renk artık dinlenme durumu). Bu tek satırlık davranış
değişikliği, isim geçişinden AYRI bir commit'te, testle kanıtlanır.

### 2. Tipografi — SADECE başlık fontu, elle doğrulama zorunlu

**Seçim:** `next/font/google`'dan **Fraunces** (değişken font, tek dosya) — SADECE
`font-serif` (başlıklar). Gövde metni (`font-sans`) bu turda **dokunulmuyor** (red-team: ikinci
bir font = ikinci bir risk yüzeyi, kapsamı büyütmenin gerekçesi yok; sistem sans zaten okunabilir).

`apps/web/src/app/layout.tsx`: `Fraunces` import edilip `--font-serif` CSS değişkeni `<html>`'e
uygulanır; `tailwind.config.ts`'nin `fontFamily.serif`'i bu değişkene bağlanır — mevcut
`font-serif` class kullanımları component değişmeden gerçek fontu alır.

**Zorunlu elle doğrulama (red-team: birim test bunu kanıtlamaz):** Uygulamadan sonra dev server'da
gerçek, uzun Türkçe mekan adlarıyla (ör. "Kadıköy'ün En Sakin Üçüncü Nesil Kahvecisi" gibi
`docs/prd.md` §örneklerinden esinlenen uzun bir başlık) venue-card ve venue-detail'i tarayıcıda
görüntüleyip satır kırılımı/taşma kontrolü yapılacak — birim testin kanıtlayamadığı tam da bu.

### 3. `next/image`'a GERÇEK optimizasyonla geçiş

`venue-card.tsx` ve `venue-detail.tsx`'teki düz `<img>` → `next/image`, **`unoptimized` DEĞİL**
(red-team: `unoptimized` byte küçültmez, hiçbir şeyi çözmez). `next.config.js`'ye
`images.remotePatterns: [{ protocol: "https", hostname: "**" }]` — gerçek sunucu-taraflı yeniden
boyutlandırma/format dönüşümü. Maliyet: admin/curator'ın girdiği keyfi HTTPS URL'lerini Next'in
görsel proxy'si sunucu tarafında fetch eder — girdi herkese açık değil (sadece admin/curator rolü,
`AdminVenueCreateSchema`), MVP için kabul edilebilir; büyürse bilinen bir domain'e (ör. Supabase
Storage) daraltılır (ayrı, sonraki karar).

**Doğrulama:** dev server'da gerçek bir mekan fotoğrafının network sekmesinde `_next/image?url=...`
üzerinden döndüğü ve orijinalden daha küçük boyutta geldiği gözlemlenir (yalnızca kod var
demekle yetinilmez).

### 4. Leaflet CSS

`apps/web/src/app/layout.tsx`'teki `import "leaflet/dist/leaflet.css"` silinip
`venue-map-leaflet.tsx`'e taşınır. **İddia yumuşatıldı** (red-team: Next'in global stylesheet
birleştirme davranışı "hiç indirmez" garantisi vermez) — `next build`'in route bazlı "First Load
JS/CSS" raporuyla gerçek fark gözlemlenir, garanti olarak değil gözlem olarak yazılır.

## Test stratejisi

- Renk isim geçişi: mekanik, davranış değişikliği yok, test gerektirmez (build+lint yeterli).
- Kontrast düzeltmesi (`bg-brandSolid`): TDD — `venue-detail.spec.tsx`'e "Yol tarifi al"
  butonunun `bg-[#bd4c30]` (veya token class'ı) taşıdığını doğrulayan test, RED→GREEN.
- Font: elle doğrulama (yukarıda) + mevcut `venue-card.spec.tsx`/`venue-detail.spec.tsx`'in
  kırılmadığı TDD'de doğrulanır (component değişmiyor, sadece layout+config).
- `next/image` geçişi: mevcut `getByRole("img")`/`alt` testleri `next/image`'ın render ettiği
  gerçek `<img>` üzerinde de çalışır — RED→GREEN ile kanıtlanır; ayrıca yukarıdaki elle
  network-doğrulaması.
- Leaflet CSS taşıma: davranışsal fark yok, test gerekmiyor; build çıktısı elle gözlemlenir.

## Kapsam dışı bırakılan, STATE.md'ye not edilecek ayrı görevler
- Mobil renk/font tutarlılığı (RN, kendi cihaz doğrulaması gerektirir).
- `FavoriteList` aynı-isim yarış durumu (`@@unique([userId, name])`) — ürün kuralı değişikliği.
