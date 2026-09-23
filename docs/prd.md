# GurmeGo — PRD

**Versiyon:** 4.0 (round 3 panel + Codex koşullu-GO sonrası revize) · **Sahip:** Hazar · **Tarih:** 2026-07-24 · **Kaynak:** gurmego.md PRD v1.0, PRD v2.0, v3.0

İlgili dokümanlar: [product-overview.md](product-overview.md) · [architecture.md](architecture.md) · [rule-engine.md](rule-engine.md) · [docs/CHANGELOG.md](CHANGELOG.md)

---

## 1. Kapsam

**MVP:** İstanbul — Kadıköy, Beşiktaş, Beyoğlu. Hedef: 30-45 mekan, 6 haftalık gerçek kullanıcı pilotu (bkz. §5 Pilot Karar Sözleşmesi). **Yalnızca web/PWA** — React Native mobil uygulama pilot doğrulaması sonrasına ertelendi.

| Faz | İçerik |
|---|---|
| **MVP (pilot)** | Mekan veri modeli (fiyat aralığı + favori ürünler) + kürasyon, keşif & arama (tamamen yapısal filtre), mekan detay (+ Google puanı özet rozeti + deep-link, + WhatsApp paylaşım), imzalı editöryal öneri, admin panel |
| **Faz 2 (pilot GO sonrası)** | React Native mobil uygulama, kullanıcı yorum/puanlama + Gurme Puanı, mekan sahibi doğrulama/itiraz akışı, kullanıcı katkı (yeni mekan önerisi/düzeltme), mekan sahibi kendi bilgisini girme, tam menü sistemi (kalem+fiyat), arama iyileştirme (doğal dil → filtre çevirisi + semantic search/pgvector), Keşif Reels, otomatik veri toplama, rozet/itibar sistemi, gelir modeli aktivasyonu, ikinci şehir |
| **İleri faz** | Influencer listeleri, B2B akışlar (mekan sahibi paneli, ücretli) |

### v3.0'dan kapsam değişiklikleri (2026-07-24, round 3 panel + `idea-red-team` round 3 sonrası)

8 perspektifli paralel panel (ürün/UX, backend/mimari, büyüme/dağıtım, veri/AI, frontend, güvenlik,
pazar + Codex karşıt görüş) projeyi tekrar tartıştı; Codex round 3'te **KOŞULLU-GO** verdi (round 1/2:
NO-GO). Tam gerekçe: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-24.

1. **Mobil (React Native) → Faz 2'ye ertelendi.** MVP yalnızca web/PWA. Gerekçe: ilk değer/retention
   web'de de ölçülebilir; App Store/Play Store onay süreci + iki platform bakım yükü, doğrulanmamış bir
   değer önerisi üstüne bindirilmiş gereksiz risk.
2. **Yorum/puanlama sistemi VE Gurme Puanı → tamamen Faz 2'ye ertelendi** (erteleme değil, MVP'den
   çıkarma). MVP'de yalnızca kürasyon ekibinin **imzalı editöryal önerisi** + Google puanının özet
   rakamı (deep-link ile) var. Gerekçe: iki bağımsız sebep — (a) cold-start'ta istatistiksel olarak
   anlamsız (herkes prior skora eşit çıkar), (b) restoran hem dağıtım ortağı hem puanlanan taraf; itiraz
   akışı olmadan kötü puan restoran ilişkisini/dağıtım kanalını zedeler. **AK-01 bu nedenle MVP için
   kapandı** — Gurme Puanı MVP'de yok, "kim verebilir" sorusu Faz 2'de tekrar açılacak.
3. **Konumlanma değişti: "tek yerden toplayan platform" değil "rehber".** Michelin/Time Out tarzı, az
   sayıda seçici, imzalı öneri. Gerekçe: Google'a karşı savunulabilir gerçek fark veri hacmi değil
   editöryal seçicilik.
4. **Mekan sahibi itiraz/doğrulama akışı: bilinçli olarak MVP'de yok.** Kullanıcı kararı — pilot küçük
   ölçekli (30-45 mekan, 6 hafta) ve ekip hataları hızlı düzeltebildiği sürece risk yönetilebilir. Codex
   sınır koydu: **50+ mekan veya 8+ hafta veya görünür trafiğe çıkıştan sonra hâlâ itiraz yolu yoksa
   savunulamaz** — Faz 2'ye geçiş kararında ilk kontrol edilecek şart bu.
5. **Doğrulama yöntemi: ayrı landing page/kronometre ön-testi yok.** Kullanıcı kararı — minimal-ama-gerçek
   ürünün kendisi doğrulama aracı; başarı/başarısızlık §5'teki Pilot Karar Sözleşmesi ile ölçülür.
6. **KVKK aydınlatma/rıza/saklama metinleri:** sistem şekillendikten sonra yazılır, ama **gerçek kullanıcı
   verisi toplanmaya başlamadan önce** yayınlanmış olmalı (KVKK'nın kendi çerçevesi bunu gerektiriyor).

### v2.0'dan kapsam değişiklikleri (2026-07-16, `idea-red-team` sonrası)

Codex (GPT-5.6 Sol, high effort) ile yapılan red-team NO-GO verdiktine karşılık kapsam daraltıldı. Tam
gerekçe tablosu: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16.

1. **Tam menü sistemi → Faz 2.** MVP'de yalnızca fiyat aralığı (₺/₺₺/₺₺₺) + "favori ürünler" metin alanı.
   Gerekçe: kalem+fiyat sürekli çürüyen envanter; tek/küçük ekip için en pahalı bakım kalemiydi.
2. **Kullanıcı katkısı (yeni mekan önerisi + düzeltme önerisi) → Faz 2.** MVP verisi yalnızca kürasyon
   ekibinden (Hazar + 1-2 kişi). Gerekçe: MVP'de kullanıcı kitlesi yokken katkı akışı çalışmaz (katkı
   için kullanıcı, kullanıcı için güvenilir veri gerekir — döngü). Moderasyon/şikayet akışı MVP'de kalır
   (yorum sistemi MVP olduğu için gerekli).
3. **Mekan sahibi kendi bilgisini girme → Faz 2 (yeni).** Önceki tasarımda hiç yoktu; artık planlı.
4. **"Butik" tanımı netleşti.** Yalnızca `branch_count ≤ eşik` DB kuralı değil; gerçek dünya kategorisi
   — zincir/franchise değil, en fazla 2-3 şubeli, Instagram/TikTok'ta mekan önerisi olarak dolaşan
   yerler. Uygulama detayı: [rule-engine.md §1](rule-engine.md).
5. **Arama iyileştirme (doğal dil + semantic search) → Faz 2.** MVP'de arama tamamen yapısal filtrelerle
   (kategori/fiyat/ilçe/mesafe) çalışır, AI/pgvector katmanı yok. Gerekçe: birkaç yüz mekanlık veri
   setinde semantic search gereksiz karmaşıklık; basit filtre yeterli.
6. **WhatsApp paylaşım eklendi (yeni, MVP).** Kullanıcılar mekanı uygulama içinden WhatsApp'a
   paylaşabilecek — organik dağıtım mekanizması.
7. **Google yorumlarına deep-link eklendi (yeni, MVP).** Places API entegrasyonu yok (ToS/maliyet
   riski); yalnızca Maps'e yönlendiren bağlantı.
8. **MVP mekan sayısı hedefi düşürüldü.** ~225 (3×75) yerine kürasyon ekibinin kapasitesine göre daha
   düşük bir sayı — kesinleşince buraya yazılacak.
9. **Keşif Reels → Faz 2.** (v2.0'dan devam) Gerekçe: dış kaynak video telif riski (NFR-09) + operasyonel yük, 3-4 ay MVP ufkuna sığmıyor. Veri modeli Reels'i destekleyecek şekilde esnek bırakılır (mekana medya referansı eklenebilir).
10. **Otomatik veri toplama → Faz 2.** (v2.0'dan devam) MVP'de veri kaynağı: yalnızca manuel kürasyon (ekip). `source` alanı baştan modellenir (manual/user/auto) — Faz 2 geçişi şemasızdır.

### Red-team bulguları — reddedilenler

- **"Gereksiz kılan çözüm var" (4 rakip aynı boşluğu hedefliyor):** kısmen reddedildi. Ürün
  konumlanması "yeni veri kaynağı" değil "tek yerden git kolaylığı + kategori bazlı rota + sosyal
  paylaşım"a kaydırıldı. **Bu yanlışsa ne olur:** GurmeGo rakiplerden daha küçük veri tabanıyla aynı
  savaşa giren geç bir kopya olarak kalır. Doğrulama planı için §5'teki yeni metriklere bakın.

---

## 2. Fonksiyonel Gereksinimler

### 2.1 Mekan Veri Modeli & Kürasyon Sistemi — MVP

- **FR-MV-01 (revize 2026-07-16):** Standart veri şeması: isim, kategori/mutfak tipi, ilçe/semt, adres,
  koordinat, ulaşım notu, çalışma saatleri, **fiyat aralığı (₺/₺₺/₺₺₺)**, **favori ürünler (serbest
  metin listesi, örn. "kaşarlı tost, filtre kahve")**, fotoğraflar, kısa editöryal not. Kalem+fiyat
  bazlı tam menü sistemi **Faz 2**.
- **FR-MV-02 (revize 2026-07-16):** MVP veri kaynağı **yalnızca manuel kürasyon** (kürasyon ekibi:
  Hazar + 1-2 kişi). Kullanıcı katkısı ve otomatik toplama Faz 2. Her kayıt `source` alanı taşır;
  kaynak bazlı kalite raporu admin panelde (FR-AP-03).
- **FR-MV-03:** Her kayıt **veri güncellik damgası** taşır (son doğrulama tarihi); N günden eski kayıtlar kürasyon kuyruğuna düşer. N değeri: [rule-engine.md](rule-engine.md).
- **FR-MV-04 (revize 2026-07-16):** "Butik" tanımı gerçek dünya kategorisine dayanır — zincir/franchise
  değil, en fazla 2-3 şubeli, Instagram/TikTok'ta mekan önerisi olarak dolaşan yerler (Burger King,
  Starbucks, Kahve Dünyası, Simit Sarayı gibi zincirlerin karşıtı); şube eşiği kod/kural olarak uygulanır
  ama tanımın kendisi kullanıcı tanınırlığına dayanır. Kurallar: [rule-engine.md](rule-engine.md).
- **FR-MV-05:** Mekan verisi versiyonlanır; hatalı güncelleme geri alınabilir.

### 2.2 Keşif & Arama — MVP

- **FR-KA-01:** Ana keşif ekranı ilçe/semt seçimine göre filtrelenir; konuma göre otomatik ilçe önerisi.
- **FR-KA-02:** Liste ↔ harita görünümü geçişi (PostGIS coğrafi sorgu, yakınlık sıralı).
- **FR-KA-03:** Filtreler: mutfak/kategori, fiyat aralığı, açık/kapalı, mesafe, "butik" etiketi.
- **FR-KA-04:** Favorilere ekleme + koleksiyon oluşturma. (Hesap gerekliliği: bkz. Açık Karar AK-02.)
- **FR-KA-05:** Veri modeli ve arama katmanı şehir-agnostik (şehir/ilçe birinci sınıf boyut).
- **FR-KA-06 (yeni 2026-07-16):** Kategori bazlı hızlı rota: kullanıcı "tatlı", "kahve" gibi bir
  kategori seçtiğinde, o kategorideki mekanlara filtrelenmiş liste + doğrudan yol tarifi (FR-MD-03 ile
  aynı deep-link mekanizması).
- **FR-KA-07 (yeni 2026-07-16, MVP'de kaldırıldı):** ~~Doğal dil arama~~ → **Faz 2**. MVP'de arama
  tamamen yapısal filtrelerle (FR-KA-03) çalışır; serbest metin arama kutusu yok. Gerekçe:
  [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16 madde 9.

### 2.3 Mekan Detay Sayfası — MVP

- **FR-MD-01 (revize 2026-07-16):** Tam profil: fiyat aralığı, favori ürünler, adres+harita, ulaşım
  notu, çalışma saatleri, fotoğraf galerisi. (Kalem+fiyat menü Faz 2 — bkz. FR-MV-01.)
- **FR-MD-02 (Faz 2'ye ertelendi 2026-07-24):** ~~Kullanıcı yorumları ve puanlama~~ → **Faz 2**. MVP'de
  yerine: kürasyon ekibinin imzalı editöryal önerisi ("Hazar burayı neden seçti") + Google puanının özet
  rakamı (bkz. FR-MD-05). Gerekçe: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-24.
- **FR-MD-03:** "Buraya nasıl giderim" — harici harita uygulamasına deep link.
- **FR-MD-04:** Veri kaynağı şeffaflığı: son doğrulama tarihi + ekleyen kaynak (kürasyon ekibi)
  gösterilir.
- **FR-MD-05 (yeni 2026-07-16, revize 2026-07-24):** Google puanının özet rakamı mekan kartında rozet
  olarak gösterilir (ör. "4.3 ★ · 120 Google yorumu") + "Google'da yorumları gör" bağlantısı Maps'e
  yönlendirir. Places API'nin tam review metnini çekmek yok (ToS/attribution kısıtları + maliyet riski);
  yalnızca özet rakam, güncel Places API atıf/saklama kurallarına uygun şekilde.
- **FR-MD-06 (yeni 2026-07-16):** Mekan paylaşımı: kullanıcı mekan sayfasını WhatsApp'a (ve platform
  paylaşım sheet'ine) tek dokunuşla gönderebilir — organik dağıtım mekanizması.

### 2.4 Kullanıcı Katkı & Geri Bildirim — Faz 2 (MVP'de yalnızca moderasyon)

- **FR-KG-01 (Faz 2'ye taşındı 2026-07-16):** Yeni mekan önerisi (temel bilgiler); kürasyon kuyruğuna
  düşer, onaysız yayınlanmaz. Gerekçe: MVP'de kullanıcı kitlesi yokken katkı akışı çalışmaz.
- **FR-KG-02 (Faz 2'ye taşındı 2026-07-16):** Mevcut mekan için düzeltme önerisi (fiyat değişti, kapandı
  vb.); kürasyon onaylı.
- **FR-KG-02b (yeni, Faz 2):** Mekan sahibi kendi bilgisini girme/güncelleme — kürasyon onaylı.
- **FR-KG-03 (revize 2026-07-24, MVP'de kalır, daraltılmış):** Yorum sistemi MVP'de yok (bkz. FR-MD-02),
  dolayısıyla yorum moderasyonu da yok. MVP'de kalan tek mekanizma: herhangi bir ziyaretçinin "bu bilgi
  yanlış" bildirimi — **rate limit + admin moderasyon kuyruğu**, kimlik doğrulaması gerektirmez, mekan
  sahibi olduğunu iddia eden ayrı bir akış değildir (o Faz 2, bkz. FR-KG-02b). `ContributionQueue`
  MVP'de yalnızca bu genel şikayet tipini işler.
- **FR-KG-04:** Rozet/itibar sistemi → **Faz 2**.

### 2.5 Gurme Puanı — Faz 2'ye ertelendi (2026-07-24)

**MVP'de bu modül hiç yok.** Kalite sinyali MVP'de yalnızca kürasyon ekibinin imzalı editöryal önerisi +
Google puanı özet rozeti (FR-MD-05). Gerekçe: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-24 — cold-start'ta
istatistiksel anlamsızlık + restoran çıkar çatışması riski (bkz. §1).

- **FR-GP-01 (Faz 2):** Her mekan için, standart yorum/yıldızdan ayrı, 5 üzerinden **Gurme Puanı**; profilde öne çıkan kalite sinyali.
- **FR-GP-02 (Faz 2):** Puan verme yetkisi **açık karar** (bkz. AK-01 — MVP için kapandı, Faz 2'de tekrar açılır). Sistem, kullanıcı rolü bazlı ağırlıklandırmayla her senaryoyu destekleyecek şekilde tasarlanır — karar sonradan konfigürasyonla uygulanır, şema değişikliği gerektirmez.
- **FR-GP-03 (Faz 2):** Hesaplama mantığı deterministik/kod tabanlı; formül [rule-engine.md](rule-engine.md)'de dokümante edilir.
- **FR-GP-04 (Faz 2):** Kötüye kullanım koruması: rate limit, tek kullanıcı-tek mekan-tek puan, şüpheli toplu puanlama tespiti (izlenebilirlik: NFR-10).

### 2.6 Arama İyileştirme (hafif AI) — Faz 2 (MVP'de yok)

**MVP'de bu modül hiç yok.** Keşif tamamen FR-KA-03'teki yapısal filtrelerle çalışır; AI çağrısı, pgvector,
embedding maliyeti sıfır. Gerekçe: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16 madde 9 — birkaç yüz
mekanlık MVP hacminde semantic search gereksiz karmaşıklık.

- **FR-AI-01 (Faz 2):** Doğal dil arama → yapısal filtre çevirisi ("yakınımda ucuz butik kahvaltıcı" → kategori+fiyat+mesafe).
- **FR-AI-02 (Faz 2):** Semantic search: editöryal notlar ve yorumlar üzerinde anlam bazlı arama (pgvector).
- **FR-AI-03 (Faz 2, korunacak invariant):** AI **destekleyici** kalacak; çekirdek keşif (liste/harita/filtre) AI olmadan tam çalışmaya devam eder — Faz 2'de bu modül eklenirken de bozulmayacak bir garanti.
- **FR-AI-04 (Faz 2):** Maliyet disiplini: küçük/ucuz model, önbellekleme, sadece gerektiğinde çağrı. Detay: [ai-prompt-design.md](ai-prompt-design.md) (Faz 2 tasarımı olarak saklanıyor).

### 2.7 Admin / Kürasyon Paneli — MVP

- **FR-AP-01:** Bekleyen mekan önerileri + güncelleme önerileri + moderasyon kuyruğu tek yerde.
- **FR-AP-02:** Toplu veri girişi/güncelleme (CSV import).
- **FR-AP-03:** Veri kalite raporu: ilçe başına mekan sayısı, N günden eski kayıtlar, kaynak dağılımı.
- **FR-AP-04:** Gurme Puanı yetkilendirme yönetimi (AK-01 kararı sonrası) bu panelden.

### 2.8 Web/PWA Uygulama Katmanı — MVP (revize 2026-07-24)

- **FR-MW-01 (revize 2026-07-24):** Tek backend/API → **yalnızca Next.js web (SSR/SSG + PWA)**. React
  Native mobil uygulama Faz 2'ye ertelendi (bkz. §1 madde 1) — pilot GO sonrası devreye girer, API zaten
  istemci-agnostik tasarlandığı için bu geçiş şema/servis sınırı değiştirmez.
- **FR-MW-02:** Konum izin akışı tarayıcı standartlarına uygun, reddedilebilir; reddedilirse manuel ilçe
  seçimiyle tam işlevsellik korunur (NFR-04).
- **FR-MW-03:** Web mekan sayfaları SEO-uyumlu (SSR/SSG) + PWA manifest/service worker — ana deneyim
  aynı zamanda organik keşif kanalı.

### 2.9 Keşif Reels — Faz 2

- **FR-KR-01..05:** v1.0'daki gibi (bölge merkezli dikey video akışı, mekan detayına bağlantı, dış kaynak telif yönetimi, kapatılabilir katman). MVP'de yalnızca veri modeli esnekliği sağlanır: mekan kaydına medya referansı eklenebilir yapı.

### 2.10 Influencer Listeleri — İleri faz

- **FR-IL-01..04:** v1.0'daki gibi. MVP veri modeli, mekanlara dış etiket/koleksiyon eklenebilir şekilde esnek bırakılır.

---

## 3. Non-Functional Gereksinimler

- **NFR-01 — Veri doğruluğu önceliği:** Kürasyon hız yerine doğruluğu önceliklendirir; yanlış fiyat aralığı/favori ürün bilgisi güveni doğrudan kırar.
- **NFR-02 — Performans:** Keşif ekranı açılışı < 2 sn; arama/filtreleme < 300 ms (ilçe başına binlerce mekan ölçeği); harita akıcı.
- **NFR-03 — Ölçeklenebilirlik:** Şehir/ilçe birinci sınıf boyut; çoklu şehre genişleme baştan destekli.
- **NFR-04 — Konum gizliliği:** Konum yalnızca yakınlık hesabı için; sunucuda gereğinden uzun tutulmaz; konum izni olmadan manuel ilçe seçimiyle tam işlevsellik.
- **NFR-05 — Maliyet disiplini (Faz 2'de geçerli olacak):** MVP'de AI çağrısı yok, maliyeti sıfır. Faz 2'de arama iyileştirme eklenince: AI maliyeti toplam altyapının küçük kısmı; küçük model + cache + gerektiğinde çağrı.
- **NFR-06 — Veri taşınabilirliği:** Mekan verisi tek komutla JSON/CSV export.
- **NFR-07 — Moderasyon:** Rate limit + şikayet mekanizması; temel spam/otomatik hesap tespiti.
- **NFR-08 — Gelir modeli esnekliği:** Model açık (reklam/freemium/B2B); mimari sonradan eklemeye uygun (`featured` alanı, rol bazlı yetki).
- **NFR-09 — Reels telif riski:** Faz 2'ye taşındı; devreye girerken kaynak atfı + takedown mekanizması + yayın öncesi onay zorunlu.
- **NFR-10 — Puanlama bütünlüğü:** Kim puan verirse versin izlenebilir (kim/ne zaman), anormal desenler raporlanabilir.

---

## 4. Açık Kararlar

### AK-01 — Gurme Puanı'nı kim verebilir? · durum: MVP İÇİN KAPANDI (2026-07-24)

Gurme Puanı modülünün kendisi MVP'den çıkarıldı (bkz. §2.5) — bu karar artık MVP'yi bloklamıyor. Faz 2'de
modül tekrar açıldığında üç seçenek hâlâ geçerli, karar o zaman verilecek:

| Seçenek | Artı | Eksi |
|---|---|---|
| **(a) Onaylı kullanıcılar** — katkı eşiğini geçen/onaylanan kullanıcılar | Editöryal ağırlık korunur, enflasyon riski düşük; gelir modelinden bağımsız | Puan hacmi yavaş büyür |
| **(b) Herkes verir, ağırlıklı hesap** — onaylı/aktif kullanıcı puanı daha ağır | Katılım yüksek | Ayırt edicilik orta; ağırlık formülü karmaşıklaşır |
| **(c) Sadece kürasyon ekibi** — kullanıcı puanlaması daha da ertelenir | En güvenli başlangıç; saf editöryal sinyal | Topluluk katılımı gecikir |

**Karar zamanı:** Faz 2 (pilot GO sonrası), Gurme Puanı modülü implementasyonundan önce. Hangi seçenek seçilirse seçilsin FR-GP-04 korumaları geçerli.

### AK-02 — Kullanıcı hesabı ne kadar zorunlu? · durum: MVP İÇİN KAPANDI (2026-09-23)

| Seçenek | Artı | Eksi |
|---|---|---|
| **(a) Anonim gezinme, katkı için hesap** — keşif/arama/detay hesapsız; favori, yorum, puan, öneri kayıtlı | Düşük sürtünme + spam koruması dengeli; endüstri standardı | Favori için kayıt bariyeri |
| **(b) Favori de hesapsız (cihaz-local)** — favoriler cihazda, hesapla sync opsiyonel | En düşük sürtünme | Ekstra geliştirme (local store + sync mantığı); cihaz değişiminde kayıp riski |
| **(c) Her şey hesaplı** | Zengin kullanıcı verisi | Yüksek onboarding sürtünmesi; keşif ürünü için riskli |

**Karar:** (a) — zaten uygulanmış durumda, yeniden değerlendirilmedi. `architecture.md` §7 auth tasarımı (a)'yı varsayılan olarak belgeliyor; `apps/api/src/venues/venues.controller.ts` ve `reports.controller.ts` keşif/arama/detay/bildirim uçlarında `JwtAuthGuard` kullanmıyor (yalnızca rate limit), `favorites.controller.ts` auth guard'lı. Kod ve mimari doküman tutarlı — bu madde sadece PRD durumunu gerçeğe eşitliyor, davranış değişikliği yok. (b)/(c)'ye geçiş ihtiyacı doğarsa (mobil cihaz-değiştirme şikayetleri, vb.) yeniden açılabilir — bkz. mimari not: (b) istemci tarafı local store+sync eklemesi, (c) endpoint guard değişikliği gerektirir.

### AK-03 — Gelir modeli · durum: AÇIK (Faz 2 başında)

Seçenekler: reklam/sponsorluk, freemium, B2B listeleme. Bkz. [product-overview.md §7](product-overview.md).
Kullanıcı notu (2026-07-16): freemium yönü tercih ediliyor ama hangi özelliklerin premium'a gireceğine
dair bir sistem/tasarım henüz yok — Faz 2 planlamasında netleştirilmeli.

---

## 5. Başarı Metrikleri

| Metrik | Tanım | Hedef |
|---|---|---|
| Veri kapsamı | 3 MVP ilçesinde ilçe başına butik mekan sayısı | Eşik belirlenecek (kürasyon ekibi kapasitesine göre — bkz. §1) |
| Veri doğruluğu | "bilgi yanlış" şikayeti / mekan görüntülenme | Eşik belirlenecek |
| Retention proxy | Haftalık ≥1 keşif ekranı dönüşü | Kohort bazlı izlenir |
| Kürasyon kuyruğu sağlığı | Şikayet → karar süresi (MVP'de yalnızca moderasyon; öneri/düzeltme kuyruğu Faz 2) | Eşik belirlenecek (öneri: ≤72 saat) |
| Şehir genişleme hazırlığı | 2. şehre geçiş mühendislik eforu | Minimum (şema değişikliği yok) |
| Gurme Puanı güvenilirliği | Anormal puanlama oranı; puan dağılımının ayırt ediciliği | AK-01 kararı sonrası eşik |

### Pilot Karar Sözleşmesi (Codex round 3 koşullu-GO şartı, 2026-07-24)

`idea-red-team` round 3, bu sözleşme koddan önce sayısallaştırılmadan **GO vermeyeceğini** belirtti —
"ne zaman çalıştı, ne zaman başarısız diyeceğiniz" belirsizse MVP doğrulama aracı değil, ucu açık bir
geliştirme projesi olur. Kullanıcı bu eşikleri olduğu gibi kabul etti (2026-07-24):

| Ölçüt | Eşik |
|---|---|
| Pilot kapsamı | 30–45 mekan (ilçe başına ~10–15) |
| Pilot süresi | 6 hafta |
| Kullanıcı edinimi | ≥150 hedef kullanıcı |
| Karar davranışı | Kullanıcıların ≥%25'i bir "karar eylemi" gösterir (Maps'e gitme, kaydetme, paylaşma) |
| 4. hafta geri dönüş | Aktif kullanıcıların ≥%20'si kendiliğinden döner |
| Veri/uyuşmazlık | Toplam mekanların <%5'i |
| Veri bakım yükü | Ayda <30 insan-saat (kürasyon ekibi toplamı) |

**Eşikler karşılanmazsa:** yeni özellik eklemek değil, ürün tezini yeniden değerlendirmek — Codex'in
sözleriyle "eşikler karşılanmazsa yeni özellik eklemek yerine tezi yeniden değerlendirme."

**Mekan sahibi itiraz akışı sınırı** (bkz. §1 madde 4): pilot bu kapsamı (30-45 mekan, 6 hafta) aşarsa
veya görünür trafiğe çıkıldıktan sonra hâlâ itiraz yolu yoksa, bu durum sürdürülemez — Faz 2 kapsamına
alınmalı.

*Reels ve Influencer metrikleri ilgili fazlar devreye girince tanımlanır.*
