# Tasarım Sistemi / Marka Kimliği — Design Doc

**Tarih:** 2026-09-22
**Durum:** Onay bekliyor (idea-red-team öncesi taslak)
**Kapsam:** Alt proje 1/4 (bkz. docs/STATE.md kararı: tasarım sistemi → mobil dayanıklılık → altyapı borcu → canlıya çıkış hazırlığı)

## Neden

`docs/DENETIM-RAPORU.md` §5.3'ün bulduğu gibi, markanın hedeflediği "sıcak, editöryel kimlik"
(docs/product-overview.md) ile kodun görsel durumu arasında fark var. Ama kod taraması gösteriyor ki
bu fark iddia edildiği kadar büyük değil: web'de zaten tutarlı, kasıtlı bir sıcak palet kullanılıyor
(`#d75d3b` terrakota 88 kez, `#201d18` mürekkep 177 kez, `#f4f0e7` krem 47 kez — 14 farklı ton, rastgele
değil, aile halinde). Gerçek eksik üç yerde:

1. **Token'sızlık:** Renkler her yerde ham hex (`bg-[#f4f0e7]`) — tek bir yerden değiştirilemiyor,
   admin'in operasyonel paleti (slate/blue) ile web'in marka paleti aynı sistemde tanımlı değil.
2. **Tipografi hiç yüklenmiyor:** `font-serif`/`font-sans` Tailwind'in jenerik stack'i (Georgia,
   system-ui) — cihaza göre değişiyor, markanın "tırnaklı editöryel" hissi rastgele.
3. **Performans/temizlik borcu:** `next/image` hiç kullanılmıyor (fotoğraflar optimize edilmeden
   gönderiliyor), Leaflet CSS'i tüm sayfalarda yükleniyor (haritasız sayfalarda bile).

## Kapsam

**Dahil:** web (tüketici, marka kimliğinin göründüğü asıl yer) + admin (kendi nötr paleti, tutarlılık
için token'lanır ama YENİDEN TASARLANMAZ — iç araç, marka kimliği taşımıyor) + mobil (aynı renk/font
token'ları, RN'e uygun formatta).

**Kapsam dışı:** Yeni bir görsel yön/renk paleti icat etmek (YAGNI — mevcut palet zaten iyi
çalışıyor, kanıtlanmamış bir değişiklik riski almanın gerekçesi yok). Admin panelinin marka
kimliğine "ısıtılması" (iç araç, önceliği yok).

## Yaklaşım

**Seçilen: mevcut paleti kanonikleştir + iki Google Font yükle + next/image'a geç.**

Alternatif 1 (yeni bir palet/tasarımcı işi baştan tasarlamak) reddedildi: mevcut palet zaten
editöryel/sıcak hissi veriyor ve production kodunda 300+ yerde kullanılıyor; değiştirmek hem riskli
hem gereksiz — sorun palet değil, palet'in *sistemleştirilmemiş* olması.

Alternatif 2 (CSS custom properties / `:root` değişkenleri) reddedildi: Tailwind zaten kurulu ve
`theme.extend.colors` üzerinden token tanımlamak, mevcut `className` kalıplarıyla (`bg-[#f4f0e7]` →
`bg-cream`) bire bir eşleşiyor, ek bir sistem kurmuyor.

### 1. Renk token'ları (packages/shared)

`packages/shared/src/design-tokens.ts`: iki katman.

```ts
export const PRIMITIVE_COLORS = {
  ink: "#201d18", terracotta: "#d75d3b", terracottaDark: "#bd4c30",
  terracottaLight: "#e77959", cream: "#f4f0e7", creamLight: "#faf7f0",
  creamPale: "#fffdf8", sand: "#eadfce", sandLight: "#eee5d7", brown: "#75402f",
} as const;

export const SEMANTIC_COLORS = {
  brand: PRIMITIVE_COLORS.terracotta,
  brandHover: PRIMITIVE_COLORS.terracottaDark,
  ink: PRIMITIVE_COLORS.ink,
  surface: PRIMITIVE_COLORS.cream,
  surfaceRaised: PRIMITIVE_COLORS.creamLight,
  surfaceCard: PRIMITIVE_COLORS.creamPale,
  accent: PRIMITIVE_COLORS.sand,
} as const;
```

`apps/web/tailwind.config.ts` ve `apps/admin/tailwind.config.ts`'nin (admin kendi nötr rengini
korur, sadece token mekanizmasını paylaşır) `theme.extend.colors`'ına bu obje import edilip
yayılır (`{ ...SEMANTIC_COLORS }`). Mevcut `bg-[#f4f0e7]` gibi ham kullanımlar **tek seferde**
`bg-surface` gibi isimli sınıflara geçirilir (mekanik, GLM'e delege edilebilir bir iş —
`delegating-bulk-work`).

Mobil (RN, Tailwind yok): aynı `SEMANTIC_COLORS` objesi doğrudan `StyleSheet.create()` içinde
import edilip kullanılır — tek kaynak, iki tüketici.

### 2. Tipografi

**Seçim:** `next/font/google` ile **Fraunces** (başlıklar — mevcut "tırnaklı serif" hissini
karşılayan, düşük-kontrast/sıcak bir serif, İstanbul/gurme yayıncılığında yaygın) + **Inter**
(gövde metni — okunabilir, nötr, zaten yaygın kullanılan bir sans). İkisi de değişken font (variable
font), tek dosya indirir, `next/font`'un kendi self-hosting'i CLS'i sıfırlar (harici Google Fonts
isteği yok, gizlilik/performans kazancı).

`apps/web/src/app/layout.tsx`ve `apps/admin/src/app/layout.tsx`: `next/font/google`'dan
`Fraunces`/`Inter` import edilip `--font-serif`/`--font-sans` CSS değişkeni olarak `<html>`'e
uygulanır; Tailwind config bu değişkenleri `fontFamily.serif`/`fontFamily.sans`'a bağlar — mevcut
`font-serif`/`font-sans` class kullanımları **hiç değişmeden** gerçek fontu almaya başlar (sıfır
component değişikliği, sadece layout + config).

Mobil: Expo'nun `expo-font` + `@expo-google-fonts/fraunces` / `@expo-google-fonts/inter` paketleri
ile `App.tsx`'te yüklenir, `useFonts()` hook'u splash screen'i hazır olana kadar bekletir.

### 3. `next/image`'a geçiş

`venue-card.tsx` ve `venue-detail.tsx`'teki düz `<img>` → `next/image`. Sorun: fotoğraf URL'leri
admin'in serbestçe girdiği keyfi dış domainler (`AdminVenueCreateSchema`'nın `photos: z.string().url()`
kısıtı dışında bir doğrulama yok) — `next.config.js`'de sabit bir `remotePatterns` listesi
tanımlanamaz. Çözüm: `unoptimized` prop'u ile next/image kullanmak — Vercel/Next'in görsel proxy
optimizasyonunu (sunucu tarafı yeniden boyutlandırma) kaybederiz ama `next/image`'ın **client-side**
kazanımlarını (otomatik `sizes`/lazy-load/no-CLS `width`+`height` zorunluluğu, modern tarayıcıda
`loading="lazy"` zaten vardı) koruruz. İleride admin'e gerçek dosya yükleme (Supabase Storage)
eklenirse `remotePatterns` tek bir bilinen domain'e daraltılıp `unoptimized` kaldırılabilir — bu
şimdiden not edilir (design'ın kapsamı dışı, ADR gerektirmez, geri dönüşü kolay bir prop değişikliği).

### 4. Leaflet CSS

`apps/web/src/app/layout.tsx`'teki `import "leaflet/dist/leaflet.css"` silinip
`venue-map-leaflet.tsx`'e (haritayı gerçekten render eden dosya) taşınır. Next.js CSS import'ları
component-scope çalışır, harita olmayan sayfalar bu dosyayı hiç indirmez.

### 5. Favoriler yarış durumu (bu pakette, çünkü aynı "cilalama" teması)

`FavoriteList`'e `@@unique([userId, name])` eklenir (yeni migration). Servis katmanında
`P2002` (unique violation) yakalanıp "zaten var" durumuna dönüştürülür (mevcut listeyi döndür,
yeni oluşturma). Bu, denetim raporunun §2.2 bulgusunu kapatır ve tasarım sistemi işiyle aynı PR
setinde, aynı "küçük ama gerçek cilalama" ruhunda.

## Test stratejisi

- Renk/font token'ları: görsel regresyon testi yok (bu repoda hiç kurulu değil, YAGNI — kapsam
  dışı bırakılıyor). Yerine: her Tailwind config'in derlendiğini (`tsc`/build) ve en az bir
  bileşenin yeni token class'ını render ettiğini doğrulayan birim test.
- `next/image` geçişi: `venue-card.spec.tsx`/`venue-detail.spec.tsx`'in mevcut testleri
  (`getByRole("img")`, `alt` metni) `next/image`'ın render ettiği gerçek `<img>` üzerinde de
  çalışır — testler değişmeden kırmızıya düşüp düşmediği TDD'de doğrulanır.
- Leaflet CSS taşıma: davranışsal fark yok, test gerekmiyor (saf dosya taşıma).
- Favori unique constraint: mevcut "aynı anda iki liste" testi zaten var mı kontrol edilecek,
  yoksa yazılacak — `@@unique` + `P2002` yakalama önce testle kırmızıya düşürülüp sonra eklenir.

## Red-team bulguları — reddedilenler
*(idea-red-team çalıştıktan sonra doldurulacak)*
