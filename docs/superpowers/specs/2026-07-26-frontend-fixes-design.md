# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Design Doc

**Tarih:** 2026-07-26 · **Durum:** Onaylandı (brainstorming + idea-red-team PIVOT sonrası tam
revizyon), idea-red-team round 2'ye hazır

İlgili: [docs/AUDIT-2026-07-26.md](../../AUDIT-2026-07-26.md) (bulguların kaynağı),
[docs/superpowers/specs/2026-07-26-backend-fixes-design.md](2026-07-26-backend-fixes-design.md) (kardeş plan — bu plan ondan SONRA yürütülmeli)

## 0. Round 1'den Round 2'ye — ne değişti

İlk tasarım idea-red-team'den **PIVOT** aldı, kodda doğrulanan bulgular:

1. **Mevcut API client (`packages/api-client`) ve web'in `lib/api.ts`'i özel header göndermeyi
   desteklemiyor** — "header'a taşı" kararı, gerçek bir implementasyon adımı olmadan yazılmıştı.
2. **`district`'lerin merkez koordinatı için "Plan 4b migration'ı ekler" dedim ama Plan 4b'de öyle
   bir migration yoktu** — iki doküman arasında gerçek olmayan bir bağımlılık uydurulmuştu.
3. **C8'in tarifi mimariyle uyuşmuyordu:** `[district]/page.tsx` bir Next.js Server Component,
   ilk sayfa yüklemesinde tarayıcı geolocation API'sine erişemez (bu bir bug değil, SSR'ın doğası) —
   "ilk çağrıda konum varsa distance'a düş" talimatı bu gerçekle çelişiyordu.
4. **C6 (kategori hızlı rotanın "doğrudan yol tarifi" eksikliği) tasarımdan tamamen düşürülmüştü**
   — audit'te olan bir bulgu sessizce kayboldu.
5. **`venue-detail.tsx`'in mekan koordinatına ihtiyacı var ama `findBySlug` bunu döndürmüyordu**
   (bkz. Plan 4b Bölüm 5 — bu round'da çözüldü).
6. **`queue-item.tsx`'in onay metni Plan 4b'nin A3 kararıyla artık çelişiyor** — round 1 bunu hiç
   ele almamıştı.

## 1. Kapsam ve hedef

`docs/AUDIT-2026-07-26.md`'nin frontend bulgularının tamamını, **gerçek mimariye uygun şekilde**
çözer. **Sıra bağımlılığı:** Plan 4b tamamlanmadan bu plan başlayamaz (header sözleşmesi, mekan
koordinatı, `open_now` backend'i, `address`/`photos` alanları — hepsi Plan 4b'nin çıktısı).

## 2. Konum header'a taşınır (A2 frontend tarafı — gerçek implementasyon)

**`packages/api-client/src/index.ts`'in `createApiClient().get()` metodu genişletilir:**
```typescript
async get<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
  const token = getToken?.();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  ...
}
```

**`apps/web/src/lib/api.ts`'e bir yardımcı eklenir:**
```typescript
function locationHeaders(coords?: { lat: number; lng: number } | null): Record<string, string> {
  return coords ? { "X-User-Location": `${coords.lat},${coords.lng}` } : {};
}
```
`getVenues`/`getNearestDistrict` çağrıları artık `coords` parametresi alır ve bu header'ı ekler.
**`serializeFilters` (venue-filters.tsx) artık `lat`/`lng`'i query objesine hiç koymaz** — yalnızca
`radiusM`'i (coords varsa) tutar; konum tamamen header üzerinden, `getVenues`'in kendi
sorumluluğunda taşınır. Bu, konumun ST_DWithin filtresi seçilmemiş olsa bile (yalnızca sıralama
için) her zaman gönderilebilmesini sağlar — bkz. Bölüm 4 (C8).

## 3. Hata yönetimi ve auth (C1, C2, C11, C12) — değişmedi, round 1'de zaten doğruydu

**C1:** `auth-context.tsx`'teki `getSession()` zincirine `.catch(() => setLoading(false))` eklenir.

**C2:** `discovery-client.tsx`'e `loading`/`error` state'i ve bir `requestId` ref'i eklenir; yanıt
geldiğinde `if (requestId !== latestRequestId.current) return;` ile eski istekler yok sayılır
(zaten `venue-map-leaflet.tsx`'te kullanılan desen).

**C11:** `favorite-button.tsx` mount olduğunda `GET /me/lists` sonucuna karşı mevcut durumu
kontrol eder (kullanıcı giriş yapmışsa); tıklandığında `disabled` olur, istek bitene kadar kalır.

**C12:** `auth-form.tsx`'e `submitting` state'i eklenir, buton `disabled={submitting}` olur.

## 4. Konum & harita doğruluğu (C3, C8 — mimariyle uyumlu düzeltme)

**C3 — Harita merkezi sabit Kadıköy (düzeltilmiş çözüm — backend migration YOK):**
MVP'de yalnızca 3 sabit ilçe var (Kadıköy, Beşiktaş, Beyoğlu) — bunlar için ayrı bir veritabanı
alanı yerine, `apps/web/src/lib/district-centers.ts` adında **statik bir sabit** eklenir:
```typescript
export const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  kadikoy: { lat: 40.9906, lng: 29.0274 },
  besiktas: { lat: 41.0422, lng: 29.0061 },
  beyoglu: { lat: 41.0370, lng: 28.9850 },
};
```
`venue-map-leaflet.tsx` artık `centerLat`/`centerLng` prop'u alır; `[district]/page.tsx` seçili
ilçenin slug'ına göre bu sabitten değeri okuyup geçer (bilinmeyen bir slug için İstanbul geneli bir
varsayılana düşer). Üç ilçe sabit olduğu sürece bu, migration'dan çok daha basit ve doğru bir
çözüm — dördüncü bir şehre geçilince (Faz 2) bu tablo genişler ya da o zaman gerçek bir DB alanına
taşınır.

**C8 — Konuma göre yakınlık sıralaması fiilen çalışmıyor (mimariyle uyumlu düzeltme):**
- `[district]/page.tsx` bir Server Component olarak **geolocation'a asla erişemez** — bu bir bug
  değil. İlk sunucu-taraflı sorgu her zaman `sort: newest` ile kalır (`initialVenues`), bu doğru.
- Gerçek düzeltme, tarayıcıda (client tarafında) olur: `discovery-client.tsx`'e, `coords`
  `null`'dan gerçek bir değere geçtiğinde (geolocation ilk kez çözüldüğünde), **kullanıcı henüz
  hiçbir filtreye dokunmamışsa**, otomatik bir tek seferlik yeniden-sorgu eklenir:
  ```typescript
  const autoSortedRef = useRef(false);
  useEffect(() => {
    if (coords && !autoSortedRef.current) {
      autoSortedRef.current = true;
      void applyFilters(filters);
    }
  }, [coords]);
  ```
- `serializeFilters`'in artık `lat`/`lng` döndürmemesi (Bölüm 2) sayesinde, `getVenues` çağrısı
  `coords` mevcut olduğunda **her zaman** `X-User-Location` header'ını gönderir (yalnızca
  `radiusM` seçiliyken değil) — backend'in `VenueListQuerySchema`'daki mevcut "konum varsa
  distance'a düş" mantığı (Plan 1'den beri var, değişmiyor) böylece otomatik devreye girer.

## 5. Mekan detay tamlığı (C4, C9, C10)

**C4 — Adres/harita/galeri eksik (artık gerçek veri mevcut, bkz. Plan 4b Bölüm 5-6):**
- `venue-detail.tsx`'e: (1) `venue.address` gösterilir (yoksa alan gizlenir, zorunlu değil), (2)
  `venue-map-leaflet` komponenti artık mevcut dekoratif CSS placeholder yerine gerçek `venue.lat`/
  `venue.lng` ile tek-nokta modunda monte edilir, (3) `venue.photos` doluysa `<img>` grid'i, boşsa
  "henüz fotoğraf eklenmedi" boş-state.

**C9 — Platform paylaşım sheet'i yok:** `whatsapp-share-button.tsx`'in yanına `"share" in navigator`
kontrolüyle korunan bir `navigator.share()` butonu eklenir (desteklenmiyorsa render edilmez).

**C10 — Google rozetinde atıf yok:** `venue-card.tsx`'teki metin `"4.3 ★ (120)"` → `"4.3 ★ · 120 Google yorumu"`;
`googleRatingCount` `null`/`undefined` ise "Google yorumu" sayısız gösterilir.

## 6. Kürasyon bütünlüğü ile senkron (Plan 4b'nin A3 kararı — yeni, round 1'de eksikti)

**`apps/admin/src/components/queue-item.tsx`'in onay açıklaması güncellenir:**
Mevcut metin — "Onayla (yalnızca incelendi olarak işaretler ve mekanın verified_at'ini yeniler)" —
Plan 4b'nin A3 kararıyla (REPORT onayı artık `verifiedAt`'i güncellemiyor) **yanlış** hale gelir.
Yeni metin: "Onayla (yalnızca bildirimi incelenmiş olarak işaretler — mekan bilgisini düzeltmek
için ayrıca admin-venues API'sinden/Prisma Studio'dan güncelleme yapılmalı)". Bu, admin panelin
2-sayfalık kapsamının (Plan 3) "gerisi Postman/Prisma Studio'ya bırakıldı" felsefesiyle tutarlı —
manuel düzeltme akışı için ayrı bir UI eklenmiyor, yalnızca metin gerçek davranışı doğru anlatıyor.

## 7. Favoriler & filtreler (C5, C7)

**C5 — Koleksiyon oluşturma UI'ı yok:** `favoriler/page.tsx`'e "Yeni liste oluştur" formu
(isim input + `POST /me/lists`) eklenir; birden fazla liste arasında geçiş için basit bir sekme/
dropdown. Tek liste varsa mevcut sessiz davranış korunur (YAGNI).

**C7 — Açık/kapalı filtresi yok:** `venue-filters.tsx`'e bir toggle eklenir (`openNow: boolean`).
`getVenues`'e parametre olarak eklenir. Backend Plan 4b Bölüm 6'da hazır olacak; query param
formatı Plan 4b'nin CSV `franchiseFlag` deseniyle aynı (`"true"` literal, coerce.boolean değil).

## 8. Kategori hızlı rota tamamlanır (C6 — round 1'de düşürülmüştü, geri eklendi)

**Sorun:** Bir kategori seçildiğinde yalnızca liste filtreleniyor; FR-KA-06'nın "doğrudan yol
tarifi" kısmı yok.

**Çözüm (yorum: en basit, sınırları net yorum):** `CategoryQuickRoute`, bir kategori seçildiğinde
ve filtrelenmiş sonuçta en az bir mekan varsa, en yakın (coords mevcutsa distance-sıralı listenin
ilk öğesi, değilse ilk öğe) mekana **doğrudan** giden bir "En yakın [kategori] mekana git" butonu
gösterir — bu buton, `venue-detail.tsx`'in zaten kullandığı harici harita deep-link mekanizmasını
(FR-MD-03) tekrar kullanır, yeni bir deep-link deseni icat edilmez.

## 9. Erişilebilirlik (C13, C14)

**C13:** Yükleme durumunda `null` yerine `<p role="status" aria-live="polite">Yükleniyor…</p>`.

**C14:** `venue-map-leaflet.tsx`'teki her `CircleMarker`'a mekan adını içeren `aria-label` eklenir.

## 10. Kod kalitesi

- `useGeolocation()`'ın iki kez çağrılması: bir `LocationProvider` context'i eklenir.
- Tekrarlanan/ölü kategori etiketleri `lib/category-labels.ts`'e taşınır, gerçek taksonomide
  olmayan girişler silinir.
- `category-quick-route.tsx`'te aktif kategoriye tekrar basmanın seçimi kaldırmaması düzeltilir.

## 11. Test/doğrulama planı

- [ ] Header gönderiminin gerçekten çalıştığı bir entegrasyon testi (mock fetch, header'ın
      istekte göründüğü doğrulanır).
- [ ] C8'in otomatik yeniden-sıralamasının gerçekten yalnızca BİR KEZ tetiklendiği (kullanıcı
      filtre değiştirdikten sonra tekrar tetiklenmediği) testi.
- [ ] Mevcut tüm testler (Plan 2/3'ten kalan) hâlâ geçiyor. `tsc --noEmit`, `pnpm run lint` temiz.
- [ ] Gerçek tarayıcıda (`pnpm run dev`) üç ilçe arasında geçiş yapılıp haritanın doğru merkezde
      açıldığı gözle teyit edilir.

## Global Constraints (writing-plans için taşınacak)

- İstemcilere iş mantığı eklenmez.
- `X-User-Location` header formatı: `"<lat>,<lng>"` — Plan 4b ile birebir aynı.
- Konum izni olmadan/reddedilirse manuel ilçe seçimiyle tam işlevsellik korunur.
