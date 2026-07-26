# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Design Doc

**Tarih:** 2026-07-26 · **Durum:** HAZIR (idea-red-team round 5 verdikti, 4 PIVOT + 1 HAZIR sonrası), writing-plans'a hazır

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

**Round 2 idea-red-team yine PIVOT verdi** — bu kez "yaklaşım temelde doğru, ayrıntı eksik".
Round 3 için ele alınanlar (hepsi kodda doğrulandı):
1. Header implementasyonu, gerçek dosyaya (`packages/api-client`'ın `get()` metodu + web'in
   `fetchValidated`/`createApiClient` zinciri, `packages/api-client/src/index.ts` DEĞİL yalnızca
   soyut bir "genişletilir" cümlesiyle) doğru bağlanmamıştı.
2. **`CategoryQuickRoute` önerisi mevcut veri sözleşmesiyle uyumsuzdu** — `VenueListItem`'da
   `lat`/`lng`/`district` yok, bileşen zaten `venues` listesini almıyor. Yeni şema alanı eklemek
   yerine, `venue-detail.tsx`'in zaten kullandığı isim+ilçe text-search deep-link'i (`directionsUrl`)
   paylaşılan bir helper'a çıkarılıp kullanılacak — ilçe zaten sayfa seviyesinde (`districtId`
   prop'undan ilçe adına çevrilebilir) biliniyor, yeni veri gerekmiyor.
3. Plan 4b'nin `VenueListQuerySchema`'sının artık `lat`/`lng`'i tamamen çıkarıp sort mantığını
   servise taşıması (bkz. Plan 4b Bölüm 2.5) nedeniyle, C8'in "backend'in mevcut mantığı
   değişmeden çalışır" iddiası düzeltildi — mantık DEĞİŞİYOR (şemadan servise taşınıyor), frontend
   tarafında bir şey değişmiyor ama iddia yanlıştı.

## 1. Kapsam ve hedef

`docs/AUDIT-2026-07-26.md`'nin frontend bulgularının tamamını, **gerçek mimariye uygun şekilde**
çözer. **Sıra bağımlılığı:** Plan 4b tamamlanmadan bu plan başlayamaz (header sözleşmesi, mekan
koordinatı, `open_now` backend'i, `address`/`photos` alanları — hepsi Plan 4b'nin çıktısı).

## 2. Konum header'a taşınır (A2 frontend tarafı — round 3'te gerçek dosyalara bağlandı)

**`packages/api-client/src/index.ts`'in `createApiClient()`'ının döndürdüğü `get()` metodu
genişletilir** (bu paket, `apps/web/src/lib/api.ts`'in `fetchValidated`'ının altında kullandığı
gerçek istemci — dosya adı ve zincir doğrulandı):
```typescript
async get<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
  const token = getToken?.();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}
```

**`apps/web/src/lib/api.ts`'teki `fetchValidated`'a bir `headers` parametresi eklenir:**
```typescript
async function fetchValidated<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  headers?: Record<string, string>,
): Promise<T> {
  const authedClient = token ? createApiClient(API_BASE, () => token) : client;
  const raw = await authedClient.get<unknown>(path, { headers });
  ...
}

function locationHeaders(coords?: { lat: number; lng: number } | null): Record<string, string> {
  return coords ? { "X-User-Location": `${coords.lat},${coords.lng}` } : {};
}
```
`getVenues`/`getNearestDistrict` artık bir `coords` parametresi alır, `fetchValidated`'a
`locationHeaders(coords)`'u dördüncü argüman olarak geçirir.
**`serializeFilters` (venue-filters.tsx) artık `lat`/`lng`'i query objesine hiç koymaz** — yalnızca
`radiusM`'i (coords varsa) tutar; konum tamamen header üzerinden, `getVenues`'in kendi
sorumluluğunda taşınır. Bu, konumun ST_DWithin filtresi seçilmemiş olsa bile (yalnızca sıralama
için) her zaman gönderilebilmesini sağlar — bkz. Bölüm 4 (C8).

**`getNearestDistrict`'in kendi çağrısı** (`districts/nearest`) artık `lat`/`lng`'i query'de değil
header'da gönderir — bu uç, Plan 4b Bölüm 2.5'te konum olmadan `400` döndüğü için `coords` burada
opsiyonel değil, zorunlu bir parametredir (çağıran taraf zaten yalnızca coords varken bu
fonksiyonu çağırıyor — `district-picker.tsx`'in mevcut akışı).

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

**Round 5 düzeltmesi — React-Leaflet'in `MapContainer.center` prop'u ilk render'dan sonra
immutable'dır:** Yalnızca `center={[centerLat, centerLng]}` prop'unu değiştirmek, kullanıcı aynı
sayfada ilçe değiştirdiğinde (client-side navigation, component yeniden mount olmadan) haritanın
merkezini GÜNCELLEMEZ — React-Leaflet bu prop'u yalnızca ilk mount'ta okur. İki seçenekten biri
kullanılır: (a) `<MapContainer key={districtSlug} center={...}>` — ilçe değişince `key` değişir,
React bileşeni sıfırdan mount eder (basit, bu ölçekte performans sorunu yaratmaz); (b) bir alt
bileşende `useMap().setView([lat, lng])` çağıran bir `useEffect`. Bu MVP'nin sayfa yapısı zaten
`[district]/page.tsx`'in her ilçe için ayrı bir route olması nedeniyle **tam sayfa navigasyonu**
gerektiriyor (Next.js App Router link geçişi), yani component muhtemelen zaten yeniden mount
oluyor — ama bunu varsaymak yerine `key={districtSlug}` ile garanti altına alınır (ucuz, kesin).

**C8 — Konuma göre yakınlık sıralaması fiilen çalışmıyor (mimariyle uyumlu düzeltme):**
- `[district]/page.tsx` bir Server Component olarak **geolocation'a asla erişemez** — bu bir bug
  değil. İlk sunucu-taraflı sorgu her zaman `sort: newest` ile kalır (`initialVenues`), bu doğru.
- Gerçek düzeltme, tarayıcıda (client tarafında) olur: `discovery-client.tsx`'e, `coords`
  `null`'dan gerçek bir değere geçtiğinde (geolocation ilk kez çözüldüğünde), **kullanıcı henüz
  hiçbir filtreye dokunmamışsa**, otomatik bir tek seferlik yeniden-sorgu eklenir. **Round 3
  düzeltmesi:** önceki taslak yalnızca `coords`+`autoSortedRef` kontrol ediyordu — kullanıcı
  geolocation çözülmeden ÖNCE bir filtre değiştirmişse yine otomatik tetiklenip kullanıcının
  seçimini görmezden gelirdi. Ayrı bir `userInteractedRef`, `handleQuickCategory` ve
  `VenueFilters`'ın `onChange`'i (yani gerçek kullanıcı etkileşimiyle çağrılan yollar, otomatik
  effect'in kendisi değil) içinde `true`'ya çekilir; otomatik effect yalnızca bu ref hâlâ `false`
  iken çalışır:
  ```typescript
  const autoSortedRef = useRef(false);
  const userInteractedRef = useRef(false);

  async function applyFilters(next: FilterState) {
    setFilters(next);
    const { data } = await getVenues({ districtId, ...serializeFilters(next) }, coords);
    setVenues(data);
  }

  function handleQuickCategory(category: string) {
    userInteractedRef.current = true;
    void applyFilters({ ...filters, category });
  }
  // VenueFilters'a geçilen onChange da aynı şekilde userInteractedRef.current = true set eder.

  useEffect(() => {
    if (coords && !autoSortedRef.current && !userInteractedRef.current) {
      autoSortedRef.current = true;
      void applyFilters(filters);
    }
  }, [coords]);
  ```
- `serializeFilters`'in artık `lat`/`lng` döndürmemesi (Bölüm 2) sayesinde, `getVenues` çağrısı
  `coords` mevcut olduğunda **her zaman** `X-User-Location` header'ını gönderir (yalnızca
  `radiusM` seçiliyken değil). **Düzeltme (round 3'te fark edilen metin çelişkisi):** "konum varsa
  distance'a düş" mantığı `VenueListQuerySchema`'da DEĞİL — Plan 4b Bölüm 2.5'te bu mantık
  şemadan `VenuesService.list`'e taşınıyor (header, Zod parse zamanında görünmediği için). Frontend
  tarafında değişen bir şey yok (yalnızca header'ı göndermek yeterli), ama "backend mantığı
  değişmeden aynen çalışıyor" ifadesi yanlıştı — mantığın KENDİSİ (şema→servis) değişiyor, yalnızca
  frontend'in bu değişiklikle etkileşimi yok.
- **C6'nın "En yakın" etiketi yalnızca konum/distance sıralaması aktifken kullanılmalı (round 3'te
  bulundu):** Konum reddedilmiş/mevcut değilse liste `newest` sıralı kalır — bu durumda listenin
  ilk öğesi "en yakın" değil, yalnızca "en yeni eklenen" demektir. `CategoryQuickRoute`'un
  butonu, `coords` mevcut değilse "En yakın [kategori] mekana git" yerine nötr bir "[Kategori]
  mekana git" metni kullanır (bkz. Bölüm 8).

## 5. Mekan detay tamlığı (C4, C9, C10)

**C4 — Adres/harita/galeri eksik (artık gerçek veri mevcut, bkz. Plan 4b Bölüm 5-6):**
- `venue-detail.tsx`'e: (1) `venue.address` gösterilir (yoksa alan gizlenir, zorunlu değil), (2)
  gerçek `venue.lat`/`venue.lng` ile tek-nokta modunda bir harita monte edilir, (3) `venue.photos`
  doluysa `<img>` grid'i, boşsa "henüz fotoğraf eklenmedi" boş-state.
  **Revizyon (implementasyon planı yazılırken kod okunarak düzeltildi):** bu bölüm ilk yazıldığında
  "mevcut dekoratif CSS placeholder yerine" (yani bir değiştirme) diyordu, ancak
  `venue-detail.tsx`'te harita için ayrı bir placeholder yok — mevcut "Sıradaki durak" bölümü
  dekoratif bir CSS deseni + `directionsUrl` linkidir, harita değildir, ve kendi başına gerekli/
  doğru bir özelliktir. Yeni harita, bu bölümün YERİNE değil, ONA EK bir bölüm olarak eklenir.

**C9 — Platform paylaşım sheet'i yok:** `whatsapp-share-button.tsx`'in yanına `"share" in navigator`
kontrolüyle korunan bir `navigator.share()` butonu eklenir (desteklenmiyorsa render edilmez).

**C10 — Google rozetinde atıf yok:** `venue-card.tsx`'teki metin `"4.3 ★ (120)"` → `"4.3 ★ · 120 Google yorumu"`;
`googleRatingCount` `null`/`undefined` ise "Google yorumu" sayısız gösterilir.

## 6. Kürasyon bütünlüğü ile senkron (Plan 4b'nin A3 kararı — yeni, round 1'de eksikti)

**`apps/admin/src/components/queue-item.tsx`'in onay açıklaması ile ilgili bayat iddia düzeltilir.**
**Revizyon (implementasyon planı yazılırken kod okunarak düzeltildi):** bu bölüm ilk yazıldığında
görünür buton metninin "... ve mekanın verified_at'ini yeniler" dediğini, dolayısıyla Plan 4b'nin
A3 kararıyla (REPORT onayı artık `verifiedAt`'i güncellemiyor) **yanlış** hale geldiğini
varsayıyordu. Gerçek dosya okunduğunda görünür metnin zaten doğru olduğu ("yalnızca incelendi
olarak işaretler", `verified_at` iddiası yok) ve bayat iddianın yalnızca butonun yakınındaki bir
KAYNAK KODU YORUMUNDA hayatta kaldığı görüldü. Düzeltme hedefi bu nedenle o yorumdur, görünür metin
değil — görünür metin isteğe bağlı olarak biraz daha açıklayıcı hale getirilebilir (ör. "... mekan
bilgisini düzeltmek için ayrıca admin-venues API'sinden/Prisma Studio'dan güncelleme yapılmalı"
eklenerek), ama bu zorunlu değildir, çünkü zaten yanlış bir şey söylemiyordu.

## 7. Favoriler & filtreler (C5, C7)

**C5 — Koleksiyon oluşturma UI'ı yok:** `favoriler/page.tsx`'e "Yeni liste oluştur" formu
(isim input + `POST /me/lists`) eklenir. **Revizyon (implementasyon planı yazılırken kod
okunarak düzeltildi):** bu bölüm ilk yazıldığında "birden fazla liste arasında geçiş için basit
bir sekme/dropdown" istiyordu, ancak gerçek `favoriler/page.tsx` zaten TÜM listeleri ayrı kart
olarak bir grid'de gösteriyor (her kart kendi favorilenmiş mekanlarını da inline listeliyor) —
bu, pilot ölçeğinde (kullanıcı başına az sayıda liste) bir sekme/dropdown'dan daha basit ve en az
o kadar kullanılabilir. Sekme/dropdown isteği bu nedenle düşürüldü; C5'in gerçek kapsamı yalnızca
liste OLUŞTURMA formudur — yeni oluşturulan liste, sayfanın zaten var olan grid'ine otomatik
olarak bir kart daha eklenerek görünür. Liste/kullanıcı sayısı arttıkça (Faz 2) gerçek bir
sekme/dropdown'a geçilebilir.

**C7 — Açık/kapalı filtresi yok:** `venue-filters.tsx`'e bir toggle eklenir (`openNow: boolean`).
`getVenues`'e parametre olarak eklenir. Backend Plan 4b Bölüm 6'da hazır olacak (`OptionalTrueFlag`
deseni); query param yalnızca `openNow=true` olarak gönderilir, `false` hiç gönderilmez (kapalı
= alan yok).

**Round 4 düzeltmesi — `isBoutique` toggle'ının kendisi de değişmeli (Plan 4b'nin backend
düzeltmesinin ön koşulu):** `venue-filters.tsx`'in butik toggle'ı bugün
`update({ isBoutique: !filters.isBoutique })` ile `true`/`false` arasında geçiş yapıyor — Plan 4b
Bölüm 6'nın yeni `OptionalTrueFlag` şeması yalnızca `"true"` veya hiç-yok kabul ettiği için,
kapatıldığında gönderilen açık `isBoutique=false` artık backend'den `400` alır. Toggle mantığı
`undefined`/`true` arasında geçecek şekilde değişir:
`update({ isBoutique: filters.isBoutique ? undefined : true })` — `serializeFilters`'ın mevcut
`if (filters.isBoutique !== undefined) out.isBoutique = String(filters.isBoutique)` satırı
değişmeden kalır (artık yalnızca `"true"` değeri üretecek, `"false"` hiç üretilmeyecek).

## 8. Kategori hızlı rota tamamlanır (C6 — round 2'de veri sözleşmesi düzeltildi)

**Sorun:** Bir kategori seçildiğinde yalnızca liste filtreleniyor; FR-KA-06'nın "doğrudan yol
tarifi" kısmı yok.

**Round 1/2'nin hatası:** Öneri, `VenueListItem`'ın `lat`/`lng`/`district` alanları varmış gibi
yazılmıştı — hiçbiri yok, `CategoryQuickRoute` da zaten `venues` listesini prop olarak almıyor
(yalnızca `activeCategory`+callback). Yeni şema alanı eklemek (mesela `VenueListItemSchema`'ya
`lat`/`lng` eklemek) gereksiz bir genişletme olurdu.

**Round 3 çözümü — mevcut deep-link deseni paylaşılır, yeni veri gerekmez:**
- `venue-detail.tsx`'teki `directionsUrl(venue)` fonksiyonu (isim+ilçe metin araması ile Google
  Maps linki üreten, zaten var olan ve "pilot ölçeğinde güvenilir" olarak belgelenen desen)
  `apps/web/src/lib/directions.ts`'e taşınır: `directionsUrl(venueName: string, districtName: string): string`.
- `[district]/page.tsx` zaten hangi ilçede olduğunu biliyor (`districtId`/sayfa parametresi) —
  ilçe adını `DiscoveryClient`'a, oradan `CategoryQuickRoute`'a prop olarak geçirir.
- `CategoryQuickRoute` artık `venues: VenueListItem[]` ve `sortedByDistance: boolean` prop'larını
  da alır (ikisi de zaten `DiscoveryClient`'ın state'inde var, yeni bir API çağrısı gerekmez).
  Bir kategori seçilip filtrelenmiş `venues` listesi boş değilse, listenin ilk öğesinin adını +
  bilinen ilçe adını `directionsUrl()`'e verir.
  **Revizyon (implementasyon planı yazılırken kod okunarak düzeltildi):** bu bölüm ilk yazıldığında
  `coordsAvailable: boolean` (yani "tarayıcı konumu çözdü mü") adında bir prop öneriyordu — fakat
  bu, "coords mevcut" ile "ekrandaki liste gerçekten distance-sıralı" durumlarını karıştırıyordu:
  kullanıcı coords çözülmeden önce bir filtre değiştirirse (auto-sort bilinçli olarak atlanır) veya
  coords'lu bir otomatik istek başarısız olursa, `coordsAvailable` yine de `true` olurdu ama
  ekrandaki liste hâlâ `newest` sıralı kalırdı — "En yakın" etiketi o durumda yanlış olurdu. Gerçek
  prop adı `sortedByDistance` — yalnızca coords'lu bir isteğin BAŞARIYLA döndüğü an `true`, aksi
  halde (coords yok, kullanıcı önce etkileşti, veya coords'lu istek başarısız oldu) `false`.
- Liste zaten (Plan 4c Bölüm 4/C8 sayesinde) konum mevcutsa distance-sıralı geldiği için "ilk öğe"
  doğal olarak "en yakın" anlamına gelir — ayrı bir mesafe hesaplaması gerekmez. **Round 3
  düzeltmesi:** buton metni `sortedByDistance`'a göre değişir — `true` ise "En yakın [kategori]
  mekana git", `false` ise (liste yalnızca `newest` sıralı, "en yakın" iddiası yanlış olur)
  nötr "[Kategori] mekana git".

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
