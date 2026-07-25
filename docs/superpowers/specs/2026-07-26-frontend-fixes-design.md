# GurmeGo — Plan 4c: Frontend/Admin Kritik Düzeltmeler — Design Doc

**Tarih:** 2026-07-26 · **Durum:** Onaylandı (brainstorming), idea-red-team'e hazır

İlgili: [docs/AUDIT-2026-07-26.md](../../AUDIT-2026-07-26.md) (tüm bulguların kaynağı),
[docs/superpowers/specs/2026-07-26-backend-fixes-design.md](2026-07-26-backend-fixes-design.md) (kardeş plan — bu plan ondan SONRA yürütülmeli, header sözleşmesi ve `open_now`/status filtreleri backend'e bağımlı)

## 1. Kapsam ve hedef

`docs/AUDIT-2026-07-26.md`'nin frontend bulgularının (9 HIGH + 18 MEDIUM/LOW) tamamını çözer.
**Bağımlılık:** Bu plan Plan 4b'den SONRA yürütülmeli — Bölüm 2 (konum header'ı) ve Bölüm 5
(açık/kapalı filtresi) backend'in yeni davranışına bağımlı.

**Kapsam dışı:** Backend değişiklikleri (Plan 4b'de), yeni özellik/tasarım, Faz 2 kapsamı.

## 2. Konum header'a taşınır (A2 frontend tarafı)

**Sorun:** `apps/web/src/lib/api.ts`, `lat`/`lng`'i GET query string'e ekliyor.

**Çözüm (Plan 4b ile birebir sözleşme):**
- `apps/web/src/lib/api.ts`'teki `getVenues`/`getNearestDistrict` fonksiyonları artık `lat`/`lng`'i
  URL'e eklemek yerine `fetch`'in `headers` objesine `"X-User-Location": "${lat},${lng}"` olarak
  ekler (konum yoksa header hiç gönderilmez).
- `discovery-client.tsx`, `district-picker.tsx` bu fonksiyonları zaten çağırdığı için değişiklik
  gerektirmez — yalnızca `lib/api.ts`'in imzası/implementasyonu değişir.

## 3. Hata yönetimi ve auth (C1, C2, C11, C12)

**C1 — `auth-context.tsx`'te `getSession()` reddi yakalanmıyor:**
- `getSession().then(...)` zincirine `.catch(() => setLoading(false))` eklenir (ya da try/catch'e
  çevrilir) — reddedilirse `loading` `false` olur, `session` `null` kalır (kullanıcı "giriş yapmamış"
  gibi davranılır, sonsuz loading yerine).

**C2 — `discovery-client.tsx`'te loading/error yok, eski istek race condition'ı:**
- `useState` ile `loading`/`error` state'i eklenir.
- Her filtre değişiminde artan bir `requestId` üretilir (`useRef`); yanıt geldiğinde
  `if (requestId !== latestRequestId.current) return;` ile eski yanıtlar yok sayılır (aynı desen
  zaten `venue-map-leaflet.tsx`'te var — proje içi tutarlı bir çözüm).

**C11 — `favorite-button.tsx` sunucu durumunu okumuyor, çift-tık koruması yok:**
- Bileşen artık prop olarak `initialIsFavorited?: boolean` alır (üst bileşen, mekan detayının
  zaten çektiği favori listesinden bunu hesaplayıp geçer) VEYA basitçe mount olduğunda
  `GET /me/lists` sonucuna karşı kontrol eder (kullanıcı giriş yapmışsa). Buton tıklandığında
  `disabled` state'e geçer, istek bitene kadar tekrar tıklanamaz.

**C12 — `auth-form.tsx`'te submitting state yok:**
- `const [submitting, setSubmitting] = useState(false)`; submit handler'ın başında `true`,
  `finally`'de `false` yapılır; butona `disabled={submitting}` eklenir.

## 4. Harita/ilçe doğruluğu (C3, C8)

**C3 — Harita merkezi sabit Kadıköy:**
- `venue-map-leaflet.tsx` artık merkez koordinatını hardcode etmek yerine prop olarak alır
  (`centerLat`, `centerLng`); `[district]/page.tsx` seçili ilçenin kendi merkezi koordinatını
  (District modelinde zaten yok — eklenmeli: `District`'e opsiyonel `centerLat`/`centerLng`
  alanı, Plan 4b'nin migration'ına dahil edilir, seed script'i günceller) bu prop'a geçer.

**C8 — İlk yükleme hep `sort:"newest"`, konum sıralaması çalışmıyor:**
- `discovery-client.tsx`'in ilk `getVenues` çağrısı, eğer `useGeolocation()` konum vermişse
  `sort: "distance"` ile başlar (backend `VenueListQuerySchema`'nın zaten yaptığı "konum varsa
  distance'a düş" mantığıyla tutarlı hale getirilir — frontend bu mantığı override etmemeli).

## 5. Mekan detay tamlığı (C4, C9, C10)

**C4 — Adres/harita/galeri eksik:**
- `venue-detail.tsx`'e: (1) mekanın açık adresi (`Venue.address` — Plan 4b'nin migration'ıyla
  eklenen yeni alan, bkz. Plan 4b Bölüm 6) gösterilir, (2) gerçek `venue-map-leaflet` komponenti
  (tek nokta, mekanın kendi konumunda) tekrar kullanılır (zaten var, yalnızca mevcut dekoratif CSS
  placeholder yerine gerçek komponent monte edilir), (3) fotoğraf galerisi — `Venue.photos`
  (Plan 4b'nin aynı migration'ıyla eklenen `String[]` alan, bkz. Plan 4b Bölüm 6) `<img>` grid'i
  olarak render edilir, boşsa "henüz fotoğraf eklenmedi" boş-state.

*Bağımlılık notu: bu task Plan 4b'nin `address`/`photos` migration'ı bittikten SONRA başlayabilir
— iki planın tek veri-şeması kesişim noktası, writing-plans'ta task-sırası olarak açıkça
belirtilecek.*

**C9 — Platform paylaşım sheet'i yok:**
- `whatsapp-share-button.tsx`'in yanına `navigator.share` kullanan (destekleniyorsa) ikinci bir
  buton eklenir; desteklenmiyorsa (çoğu masaüstü tarayıcı) buton hiç render edilmez (progressive
  enhancement — `"share" in navigator` kontrolü).

**C10 — Google rozetinde atıf yok:**
- `venue-card.tsx`'teki rozet metni `"4.3 ★ (120)"` yerine `"4.3 ★ · 120 Google yorumu"` formatına
  çevrilir (api-spec.md FR-MD-05'in örnek formatıyla birebir).
- `googleRatingCount` `null` ise (B4 backend fix'i sonrası bu daha az olası ama yine de olabilir)
  "Google yorumu" ibaresi sayısız gösterilir, `null` yazdırılmaz.

## 6. Favoriler & filtreler (C5, C7)

**C5 — Koleksiyon oluşturma UI'ı yok:**
- `favoriler/page.tsx`'e basit bir "Yeni liste oluştur" formu (isim input + buton, `POST /me/lists`)
  eklenir; kullanıcı birden fazla listesi arasında sekme/dropdown ile geçebilir. Mekan detayındaki
  "favoriye ekle" akışı da (varsa birden fazla liste) hangi listeye ekleneceğini sorar (tek liste
  varsa mevcut sessiz davranış korunur — YAGNI, karmaşık bir seçim UI'ı gerekmez).

**C7 — Açık/kapalı filtresi yok:**
- `venue-filters.tsx`'e bir toggle eklenir (`open_now` boolean); `api.ts`'in `getVenues` çağrısına
  parametre olarak eklenir. Backend tarafı Plan 4b Bölüm 6'da (`openNow` query param'ı) zaten
  planlanmış durumda — bu task ondan sonra başlar.

## 7. Erişilebilirlik (C13, C14)

**C13 — Yükleme durumunda `null` dönülüyor, ekran okuyucuya bildirim yok:**
- `favoriler/page.tsx`, `admin`'in korumalı layout'u ve kuyruk sayfası, `null` yerine
  `<p role="status" aria-live="polite">Yükleniyor…</p>` render eder (görsel olarak gizlenebilir
  bir spinner ile birlikte, ama DOM'da gerçek bir durum anonsu olarak var olur).

**C14 — Harita marker'ları erişilebilir değil:**
- `venue-map-leaflet.tsx`'teki her `CircleMarker`'a `alt`/`aria-label` (mekan adı) eklenir; ayrıca
  harita altına/yanına ekran-okuyucu-dostu bir metin liste alternatifi (zaten `venue-list.tsx`
  var olduğu için, harita+liste aynı sayfada ise liste zaten bu işlevi görüyor — yalnızca marker'lara
  `aria-label` eklemek yeterli, ayrı bir liste icat edilmez).

## 8. Kod kalitesi (küçük bulgular, tek task'ta toplanır)

- `useGeolocation()`'ın `discovery-client.tsx` ve `district-picker.tsx`'te iki kez çağrılması:
  bir `LocationProvider` context'i eklenir, ikisi de aynı context'ten okur.
- `venue-detail.tsx`/`venue-card.tsx`'teki tekrarlanan kategori etiketleri ortak bir dosyaya
  (`lib/category-labels.ts`) taşınır; kullanılmayan (`kahvalti`, `kahve`, `tatli` gibi gerçek
  taksonomide olmayan) ölü girişler silinir.
- `category-quick-route.tsx`'te aktif kategoriye tekrar basmanın seçimi kaldırmaması: toggle
  davranışı diğer filtrelerle tutarlı hale getirilir.

## 9. Test/doğrulama planı

- [ ] Her düzeltme kendi TDD döngüsünden geçer (writing-plans'ta task bazlı).
- [ ] Mevcut tüm testler (Plan 2/3'ten kalan) hâlâ geçiyor.
- [ ] `tsc --noEmit` ve `pnpm run lint` temiz.
- [ ] En az bir manuel/gerçek tarayıcı doğrulaması: `pnpm run dev` ile açılıp üç ilçe arasında
      geçiş yapılıp haritanın gerçekten doğru merkezde açıldığı gözle teyit edilir (bu tür bir
      bug otomatik testte kolayca kaçabilir, Plan 3'ün admin final review'ında olduğu gibi).

## Global Constraints (writing-plans için taşınacak)

- İstemcilere iş mantığı eklenmez — yalnızca görüntüleme + istek katmanı (mevcut proje kuralı).
- `X-User-Location` header formatı: `"<lat>,<lng>"` — Plan 4b ile birebir aynı sözleşme.
- Konum izni olmadan/reddedilirse manuel ilçe seçimiyle tam işlevsellik korunur (NFR-04/FR-MW-02,
  bu planın hiçbir task'ı bunu bozmaz — header eklenmiyor demek, endpoint yine çalışır).
