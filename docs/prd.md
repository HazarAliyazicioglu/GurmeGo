# GurmeGo — PRD

**Versiyon:** 2.0 (rafine) · **Sahip:** Hazar · **Tarih:** 2026-07-06 · **Kaynak:** gurmego.md PRD v1.0

İlgili dokümanlar: [product-overview.md](product-overview.md) · [architecture.md](architecture.md) · [rule-engine.md](rule-engine.md)

---

## 1. Kapsam

**MVP:** İstanbul — Kadıköy, Beşiktaş, Beyoğlu. Hedef: 3-4 ay. Mobil (React Native) önce, web (Next.js SSR/SSG) SEO destek.

| Faz | İçerik |
|---|---|
| **MVP** | Mekan veri modeli + kürasyon, keşif & arama, mekan detay, kullanıcı katkı, Gurme Puanı (esnek tasarım), admin panel, hafif AI arama |
| **Faz 2** | Keşif Reels, otomatik veri toplama, rozet/itibar sistemi, genişletilmiş semantic search, gelir modeli aktivasyonu, ikinci şehir |
| **İleri faz** | Influencer listeleri, B2B akışlar (mekan sahibi paneli) |

### v1.0'dan kapsam değişiklikleri

1. **Keşif Reels → Faz 2.** Gerekçe: dış kaynak video telif riski (NFR-09) + operasyonel yük, 3-4 ay MVP ufkuna sığmıyor. Veri modeli Reels'i destekleyecek şekilde esnek bırakılır (mekana medya referansı eklenebilir).
2. **Otomatik veri toplama → Faz 2.** MVP'de veri kaynağı: manuel kürasyon (ekip) + kullanıcı katkısı. Gerekçe: 3 ilçe için manuel kürasyon yeterli; scraper/pipeline eforu ve hukuki inceleme ertelenir. `source` alanı baştan modellenir (manual/user/auto) — Faz 2 geçişi şemasızdır.

---

## 2. Fonksiyonel Gereksinimler

### 2.1 Mekan Veri Modeli & Kürasyon Sistemi — MVP

- **FR-MV-01:** Standart veri şeması: isim, kategori/mutfak tipi, ilçe/semt, adres, koordinat, ulaşım notu, çalışma saatleri, fiyat aralığı, örnek menü (kalem+fiyat), fotoğraflar, kısa editöryal not.
- **FR-MV-02 (revize):** MVP veri kaynağı **manuel kürasyon + kullanıcı katkısı**. Otomatik toplama Faz 2. Her kayıt `source` alanı taşır; kaynak bazlı kalite raporu admin panelde (FR-AP-03).
- **FR-MV-03:** Her kayıt **veri güncellik damgası** taşır (son doğrulama tarihi); N günden eski kayıtlar kürasyon kuyruğuna düşer. N değeri: [rule-engine.md](rule-engine.md).
- **FR-MV-04:** "Butik" tanımı kod/kurala bağlanır (zincir/şube eşiği); zincirler otomatik dışlanır veya ayrı kategoriye alınır. Kurallar: [rule-engine.md](rule-engine.md).
- **FR-MV-05:** Mekan verisi versiyonlanır; hatalı güncelleme geri alınabilir.

### 2.2 Keşif & Arama — MVP

- **FR-KA-01:** Ana keşif ekranı ilçe/semt seçimine göre filtrelenir; konuma göre otomatik ilçe önerisi.
- **FR-KA-02:** Liste ↔ harita görünümü geçişi (PostGIS coğrafi sorgu, yakınlık sıralı).
- **FR-KA-03:** Filtreler: mutfak/kategori, fiyat aralığı, açık/kapalı, mesafe, "butik" etiketi.
- **FR-KA-04:** Favorilere ekleme + koleksiyon oluşturma. (Hesap gerekliliği: bkz. Açık Karar AK-02.)
- **FR-KA-05:** Veri modeli ve arama katmanı şehir-agnostik (şehir/ilçe birinci sınıf boyut).

### 2.3 Mekan Detay Sayfası — MVP

- **FR-MD-01:** Tam profil: menü (kalem+fiyat), fiyat aralığı özeti, adres+harita, ulaşım notu, çalışma saatleri, fotoğraf galerisi.
- **FR-MD-02:** Kullanıcı yorumları ve puanlama; en güncel/faydalı yorum öne çıkar.
- **FR-MD-03:** "Buraya nasıl giderim" — harici harita uygulamasına deep link.
- **FR-MD-04:** Veri kaynağı şeffaflığı: son doğrulama tarihi + ekleyen kaynak (kürasyon ekibi / kullanıcı) gösterilir.

### 2.4 Kullanıcı Katkı & Geri Bildirim — MVP

- **FR-KG-01:** Yeni mekan önerisi (temel bilgiler); kürasyon kuyruğuna düşer, onaysız yayınlanmaz.
- **FR-KG-02:** Mevcut mekan için düzeltme önerisi (fiyat değişti, kapandı vb.); kürasyon onaylı.
- **FR-KG-03 (netleşti):** Yorum/puan moderasyonu MVP seviyesi: **rate limit + şikayet mekanizması + admin moderasyon kuyruğu**. Ön moderasyon yok (yorumlar anında yayınlanır, şikayet üzerine incelenir). Otomatik spam filtresi Faz 2.
- **FR-KG-04:** Rozet/itibar sistemi → **Faz 2**.

### 2.5 Gurme Puanı — MVP (esnek tasarım)

- **FR-GP-01:** Her mekan için, standart yorum/yıldızdan ayrı, 5 üzerinden **Gurme Puanı**; profilde öne çıkan kalite sinyali.
- **FR-GP-02:** Puan verme yetkisi **açık karar** (bkz. AK-01). Sistem, kullanıcı rolü bazlı ağırlıklandırmayla her senaryoyu destekleyecek şekilde tasarlanır — karar sonradan konfigürasyonla uygulanır, şema değişikliği gerektirmez.
- **FR-GP-03:** Hesaplama mantığı deterministik/kod tabanlı; formül [rule-engine.md](rule-engine.md)'de dokümante edilir.
- **FR-GP-04:** Kötüye kullanım koruması: rate limit, tek kullanıcı-tek mekan-tek puan, şüpheli toplu puanlama tespiti (izlenebilirlik: NFR-10).

### 2.6 Arama İyileştirme (hafif AI) — MVP, destekleyici

- **FR-AI-01:** Doğal dil arama → yapısal filtre çevirisi ("yakınımda ucuz butik kahvaltıcı" → kategori+fiyat+mesafe).
- **FR-AI-02:** Semantic search: editöryal notlar ve yorumlar üzerinde anlam bazlı arama (pgvector).
- **FR-AI-03:** AI **destekleyici**; çekirdek keşif (liste/harita/filtre) AI olmadan tam çalışır.
- **FR-AI-04:** Maliyet disiplini: küçük/ucuz model, önbellekleme, sadece gerektiğinde çağrı. Detay: [ai-prompt-design.md](ai-prompt-design.md).

### 2.7 Admin / Kürasyon Paneli — MVP

- **FR-AP-01:** Bekleyen mekan önerileri + güncelleme önerileri + moderasyon kuyruğu tek yerde.
- **FR-AP-02:** Toplu veri girişi/güncelleme (CSV import).
- **FR-AP-03:** Veri kalite raporu: ilçe başına mekan sayısı, N günden eski kayıtlar, kaynak dağılımı.
- **FR-AP-04:** Gurme Puanı yetkilendirme yönetimi (AK-01 kararı sonrası) bu panelden.

### 2.8 Mobil + Web Uygulama Katmanı — MVP

- **FR-MW-01:** Tek backend/API → React Native (mobil) + Next.js (web).
- **FR-MW-02:** Konum/bildirim izin akışları platform kurallarına uygun, reddedilebilir.
- **FR-MW-03:** Web mekan sayfaları SEO-uyumlu (SSR/SSG) — organik keşif kanalı.

### 2.9 Keşif Reels — Faz 2

- **FR-KR-01..05:** v1.0'daki gibi (bölge merkezli dikey video akışı, mekan detayına bağlantı, dış kaynak telif yönetimi, kapatılabilir katman). MVP'de yalnızca veri modeli esnekliği sağlanır: mekan kaydına medya referansı eklenebilir yapı.

### 2.10 Influencer Listeleri — İleri faz

- **FR-IL-01..04:** v1.0'daki gibi. MVP veri modeli, mekanlara dış etiket/koleksiyon eklenebilir şekilde esnek bırakılır.

---

## 3. Non-Functional Gereksinimler

- **NFR-01 — Veri doğruluğu önceliği:** Kürasyon hız yerine doğruluğu önceliklendirir; yanlış fiyat/menü güveni doğrudan kırar.
- **NFR-02 — Performans:** Keşif ekranı açılışı < 2 sn; arama/filtreleme < 300 ms (ilçe başına binlerce mekan ölçeği); harita akıcı.
- **NFR-03 — Ölçeklenebilirlik:** Şehir/ilçe birinci sınıf boyut; çoklu şehre genişleme baştan destekli.
- **NFR-04 — Konum gizliliği:** Konum yalnızca yakınlık hesabı için; sunucuda gereğinden uzun tutulmaz; konum izni olmadan manuel ilçe seçimiyle tam işlevsellik.
- **NFR-05 — Maliyet disiplini:** AI maliyeti toplam altyapının küçük kısmı; küçük model + cache + gerektiğinde çağrı.
- **NFR-06 — Veri taşınabilirliği:** Mekan verisi tek komutla JSON/CSV export.
- **NFR-07 — Moderasyon:** Rate limit + şikayet mekanizması; temel spam/otomatik hesap tespiti.
- **NFR-08 — Gelir modeli esnekliği:** Model açık (reklam/freemium/B2B); mimari sonradan eklemeye uygun (`featured` alanı, rol bazlı yetki).
- **NFR-09 — Reels telif riski:** Faz 2'ye taşındı; devreye girerken kaynak atfı + takedown mekanizması + yayın öncesi onay zorunlu.
- **NFR-10 — Puanlama bütünlüğü:** Kim puan verirse versin izlenebilir (kim/ne zaman), anormal desenler raporlanabilir.

---

## 4. Açık Kararlar

### AK-01 — Gurme Puanı'nı kim verebilir? · durum: AÇIK

Sistem rol bazlı ağırlıklandırmayla üç senaryoyu da destekler; karar konfigürasyonla uygulanır.

| Seçenek | Artı | Eksi |
|---|---|---|
| **(a) Onaylı kullanıcılar** — katkı eşiğini geçen/onaylanan kullanıcılar | Editöryal ağırlık korunur, enflasyon riski düşük; gelir modelinden bağımsız | Puan hacmi yavaş büyür |
| **(b) Herkes verir, ağırlıklı hesap** — onaylı/aktif kullanıcı puanı daha ağır | Katılım yüksek | Ayırt edicilik orta; ağırlık formülü karmaşıklaşır |
| **(c) MVP'de sadece kürasyon ekibi** — kullanıcı puanlaması Faz 2 | En güvenli başlangıç; saf editöryal sinyal | Topluluk katılımı gecikir |

**Karar zamanı:** MVP geliştirme sırasında, Gurme Puanı modülü implementasyonundan önce. Hangi seçenek seçilirse seçilsin FR-GP-04 korumaları geçerli.

### AK-02 — Kullanıcı hesabı ne kadar zorunlu? · durum: AÇIK

| Seçenek | Artı | Eksi |
|---|---|---|
| **(a) Anonim gezinme, katkı için hesap** — keşif/arama/detay hesapsız; favori, yorum, puan, öneri kayıtlı | Düşük sürtünme + spam koruması dengeli; endüstri standardı | Favori için kayıt bariyeri |
| **(b) Favori de hesapsız (cihaz-local)** — favoriler cihazda, hesapla sync opsiyonel | En düşük sürtünme | Ekstra geliştirme (local store + sync mantığı); cihaz değişiminde kayıp riski |
| **(c) Her şey hesaplı** | Zengin kullanıcı verisi | Yüksek onboarding sürtünmesi; keşif ürünü için riskli |

**Karar zamanı:** architecture.md auth tasarımından önce. API tasarımı (a)'yı varsayılan alır; (b)'ye geçiş istemci tarafı ekleme, (c)'ye geçiş endpoint guard değişikliği.

### AK-03 — Gelir modeli · durum: AÇIK (Faz 2 başında)

Seçenekler: reklam/sponsorluk, freemium, B2B listeleme. Bkz. [product-overview.md §7](product-overview.md).

---

## 5. Başarı Metrikleri

| Metrik | Tanım | Hedef |
|---|---|---|
| Veri kapsamı | 3 MVP ilçesinde ilçe başına butik mekan sayısı | Eşik belirlenecek (öneri: ilçe başına ≥75 onaylı mekan) |
| Veri doğruluğu | "bilgi yanlış" şikayeti / mekan görüntülenme | Eşik belirlenecek |
| Retention proxy | Haftalık ≥1 keşif ekranı dönüşü | Kohort bazlı izlenir |
| Katkı oranı | Kullanıcı öneri+düzeltme / toplam mekan | Zamanla artış |
| Kürasyon kuyruğu sağlığı | Öneri → yayın süresi | Eşik belirlenecek (öneri: ≤72 saat) |
| Şehir genişleme hazırlığı | 2. şehre geçiş mühendislik eforu | Minimum (şema değişikliği yok) |
| Gurme Puanı güvenilirliği | Anormal puanlama oranı; puan dağılımının ayırt ediciliği | AK-01 kararı sonrası eşik |

*Reels ve Influencer metrikleri ilgili fazlar devreye girince tanımlanır.*
