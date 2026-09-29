# Web i18n altyapısı — tasarım

**Tarih:** 2026-09-29
**Durum:** Taslak — idea-red-team bekliyor

## Neden

PRD'de turist persona veya çok dillilik gereksinimi **yok** — bu, MVP pilotu
sonrası büyüme için önceden hazırlanan stratejik bir bahis (kullanıcı kararı,
2026-09-29). Somut bir talep/sinyal yok. Bu yüzden kapsam bilinçli olarak dar
tutuldu: **sadece altyapı**, içerik çevirisi değil.

## Kapsam

**Dahil:**
- `apps/web` (Next.js 16, App Router) — SEO yüzü olduğu için öncelikli.
- `next-intl` ile TR (varsayılan, prefix'siz) + EN (`/en` prefix'li) routing.
- Route segment isimlerinin çevirisi (`pathnames` config) — aşağıdaki tablo.
- Tüm mevcut TR string'lerin `messages/tr.json`'a key olarak çıkarılması.
- `messages/en.json` — **başlangıçta `tr.json`'ın birebir kopyası** (yapı
  hazır, içerik henüz çevrilmemiş — gerçek çeviri ayrı bir iş/karar).

**Hariç (bilinçli sınır):**
- `apps/mobile` — ayrı bir tur, farklı kütüphane (react-i18next/i18n-js),
  farklı tasarım gerektiriyor.
- `apps/admin` — iç araç, Türkçe kürasyon ekibi için, i18n gerekmiyor.
- Mekan verisi çevirisi (isim/açıklama/menü, `apps/api`'den gelen) — bu iş
  sadece **UI kabuğunu** kapsıyor. `/en/venue/...` sayfasında buton/etiketler
  İngilizce, mekan açıklaması Türkçe kalacak. Veri çevirisi çok daha büyük bir
  Faz 2 kararı (30-45+ mekan içeriği + kim çevirecek/kalite/maliyet).
- Gerçek İngilizce çeviri metinlerinin yazılması — bu tur sadece yapıyı kurar.

## Route slug eşlemesi

| TR (mevcut) | EN (yeni) |
|---|---|
| `/` | `/` |
| `/[district]` (kadikoy, besiktas, beyoglu) | aynı — semt adları çevrilmez |
| `/mekan/[slug]` | `/venue/[slug]` |
| `/mekan-oner` | `/suggest-venue` |
| `/favoriler` | `/favorites` |
| `/giris` | `/login` |
| `/sifre-unuttum` | `/forgot-password` |
| `/sifre-yenile` | `/reset-password` |
| `/gizlilik` | `/privacy` |
| `/kullanim-kosullari` | `/terms` |

## Mimari

### Yeni dosyalar
- `apps/web/src/i18n/routing.ts` — `defineRouting({ locales: ['tr','en'], defaultLocale: 'tr', localePrefix: 'as-needed', pathnames })`
- `apps/web/src/i18n/navigation.ts` — `createNavigation(routing)` → localize eden `Link`, `redirect`, `usePathname`, `useRouter`
- `apps/web/src/i18n/request.ts` — `getRequestConfig()`, `messages/{locale}.json` yükler
- `apps/web/middleware.ts` — next-intl middleware, matcher `/((?!api|_next|.*\\..*).*)`
- `apps/web/messages/tr.json`, `apps/web/messages/en.json`

### Değişen yapı
- `apps/web/src/app/**` → `apps/web/src/app/[locale]/**` (tüm route'lar taşınır; test dosyaları birlikte taşınır, içerik değişmez).
- `app/[locale]/layout.tsx` — mevcut `app/layout.tsx`'in yerini alır: `<html lang={locale}>`, `NextIntlClientProvider`, `generateStaticParams()` (`['tr','en']`), `setRequestLocale(locale)`.
- **`app/global-error.tsx` gerçek `app/` kökünde kalır**, `[locale]` altına taşınmaz — Next.js App Router kısıtı (kök layout çökerse locale context zaten yok). PR #65'te eklenen dosyayla çakışmaz, sadece yerinde kalır.
- `app/not-found.tsx` (kök, minimal fallback) + `app/[locale]/not-found.tsx` (gerçek, lokalize) — next-intl'in standart deseni.
- `next.config.js` — `createNextIntlPlugin()` ile sarmalanır.
- Her `next/link` importu → `@/i18n/navigation`'daki `Link`; her `next/navigation`'dan `usePathname`/`useRouter` importu → aynı dosyadaki lokalize sarmalayıcı.
- Her hardcoded TR string → `useTranslations()`/`getTranslations()` ile `messages/tr.json`'dan key okuma.

### Mekanik iş (GLM'e delege edilecek kısım)
Route taşıma + string extraction + Link/navigation import değişimi, 10 route +
bileşenler genelinde tekrarlayan iş. Ben ilk 1-2 route'u (`page.tsx`,
`[district]/page.tsx`) örnek olarak elle yapıp deseni sabitledikten sonra
kalanını `delegating-bulk-work` ile GLM'e vereceğim — testler hariç (TDD
kuralı, testleri ben yazarım).

## Veri akışı

- Middleware URL prefix'inden locale çözer; yoksa `Accept-Language` header'ına
  bakar; o da yoksa `tr`'ye düşer. Çözülen locale bir cookie'de (`NEXT_LOCALE`)
  saklanır ki sonraki ziyaretlerde prefix'siz TR yerine son tercih hatırlansın.
- Server component'ler `getTranslations()`, client component'ler
  `useTranslations()` (her ikisi de `request.ts`'deki config'i okur).
- API çağrıları **etkilenmez** — bu tamamen sunum/routing katmanı değişikliği,
  `apps/api`'de hiçbir değişiklik gerekmiyor.

## Hata yönetimi

- Bilinmeyen locale segmenti (`/xx/...`) → `notFound()` (next-intl varsayılanı).
- Eksik çeviri anahtarı → next-intl varsayılan davranışı korunur: anahtarın
  kendisi render edilir + dev modda konsol uyarısı. Sessizce boş bırakılmaz —
  eksik çeviri görünür olsun diye bilinçli tercih.

## Test

- Mevcut 40 test dosyası, sayfalarıyla birlikte `app/[locale]/...` altına
  taşınır — yol değişir, test içeriği/assertion'ları değişmez.
- Yeni `test-utils/render-with-intl.tsx` — `NextIntlClientProvider` ile saran
  ortak render yardımcı fonksiyonu (mevcut testler `useTranslations()`
  kullanan bileşenleri render edebilsin diye).
- Yeni testler: middleware locale negotiation (TR varsayılan, `/en` prefix,
  bilinmeyen locale → 404), `routing.ts`'deki `pathnames` eşlemesinin her iki
  yönde (TR→EN, EN→TR) doğruluğu.
- `next build` (CI'daki placeholder env değişkenleriyle) — her iki locale için
  statik sayfa üretiminin gerçekten çalıştığını doğrular.

## SEO: hreflang

Kapsama dahil — locale-prefixli URL'ler `hreflang` alternate link'leri olmadan
arama motorlarına duplicate content gibi görünüp mevcut TR SEO değerine zarar
verebilir (bu işin "web SEO yüzü olduğu için öncelikli" gerekçesiyle çelişir).
`generateMetadata()`'ya her sayfada `alternates.languages` eklenir
(`{ tr: '<TR url>', en: '<EN url>' }`), `sitemap.ts` her URL için iki locale
girdisi üretir.

## Red-team bulguları — reddedilenler

_(idea-red-team çalıştıktan sonra doldurulacak)_

## Açık riskler / bilinen sınırlar

- `apps/web/vitest.setup.ts` ve mevcut test yardımcılarının next-intl
  context'iyle uyumu ilk denemede sorunsuz çalışmayabilir — plan bu riski
  ayrı bir task olarak izole etmeli.
