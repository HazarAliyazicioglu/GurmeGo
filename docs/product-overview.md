# GurmeGo — Product Overview

**Versiyon:** 1.0 · **Sahip:** Hazar · **Tarih:** 2026-07-06 · **Durum:** Onaylı

---

## 1. Vizyon & Elevator Pitch

GurmeGo, şehirlerin ilçelerinde saklı kalmış **butik ve özel yemek mekanlarını**, zincir kalabalığına boğulmadan, tam ve güvenilir yapısal veriyle (konum, ulaşım, menü, fiyat) keşfetmeni sağlayan mobil öncelikli platformdur.

> **Tek cümle:** "Semtindeki gerçek butik mekanı; menüsü, fiyatı ve nasıl gideceğinle birlikte bulan uygulama."

**Değer önerisi üç sütun üzerine kurulu:**

1. **Kürasyon** — zincirler dışlanır, her mekan editöryal süzgeçten geçer; "herkesin bildiği yer" değil "gerçek keşif".
2. **Yapısal veri derinliği** — menü kalem+fiyat, fiyat aralığı, ulaşım notu, çalışma saatleri; hepsi doğrulanmış ve güncellik damgalı.
3. **İlçe bazlı yerel odak** — şehir geneli değil, "bulunduğum ilçedeki butik kahvaltıcılar" derinliğinde keşif.

## 2. Problem

1. **Butik mekanlar görünmüyor:** Google Maps ve genel platformlarda zincirler ve yüksek reklam bütçeli yerler öne çıkıyor; butik mekanlar kayboluyor.
2. **Veri eksik/güncel değil:** Menü, fiyat, ulaşım bilgisi çoğu platformda yok ya da bayat; kullanıcı gitmeden gerçek fikir edinemiyor.
3. **Dağınık keşif:** Mekanı Instagram'da gör, fiyatı DM'den sor, konumu Maps'te ara, yorumu başka yerde oku — tek akış yok.
4. **İlçe/semt derinliği yok:** Yerel, spesifik keşif ihtiyacına cevap veren araç yok; şehir bazlı listeler çok geniş.

## 3. Hedef Kullanıcı

**Genel tüketici (B2C, herkese açık):**

- Butik mekan keşfetmeyi seven, "gerçek keşif" arayan kullanıcı
- Gitmeden ne bulacağını bilmek isteyen pratik kullanıcı (menü, fiyat, ulaşım)
- Yaşadığı/gezdiği ilçeye özgü yerel öneri arayan kullanıcı
- Sosyal medyada gördüğü mekanın detayını tek yerde doğrulamak isteyen kullanıcı

*Restoran sahipleri bu sürümde hedef değil; B2B akışlar ileri faz.*

## 4. Rekabet Konumu

| Ürün | Güçlü yanı | Kör noktası |
|---|---|---|
| Google Maps | Kapsam, konum/yol tarifi | Kürasyon yok; zincir/butik ayrımı yok; menü-fiyat eksik |
| Yelp / TripAdvisor | Yorum hacmi | TR'de zayıf yerelleşme; butik kürasyonu yok |
| Instagram / TikTok | Keşif ilhamı, görsellik | Yapısal veri yok; dağınık, tekrar bulunamaz |

GurmeGo üçünün kesişimindedir. **Savunulabilir fark:** kürasyon + yapısal veri derinliği + ilçe bazlı odak. Genel haritalar butik mekanı zincirin içinde kaybeder; sosyal medya aranabilir/karşılaştırılabilir veri sunmaz.

## 5. Platform Stratejisi

**Mobil önce, web SEO destek:**

- **React Native mobil uygulama** = ana deneyim (konum bazlı keşif, harita, favoriler)
- **Next.js web (SSR/SSG)** = mekan sayfaları Google'da indekslenir → organik keşif kanalı; app'e yönlendirme hunisi
- Tek backend/API iki istemciyi besler (bkz. [architecture.md](architecture.md))

## 6. MVP Kapsamı

**Coğrafi kapsam:** İstanbul — **Kadıköy, Beşiktaş, Beyoğlu** (butik mekan yoğunluğu en yüksek 3 ilçe). Veri modeli şehir-agnostik; ikinci şehre geçiş minimum mühendislik değişikliğiyle.

**Zamanlama:** 3-4 ay agresif MVP. Bu ufuk kapsam disiplinini zorunlu kılar — çekirdek dışı her şey Faz 2'ye.

### Modüller

| Modül | MVP | Faz 2 |
|---|---|---|
| Mekan Veri Modeli & Kürasyon Sistemi | ✅ Çekirdek | |
| Keşif & Arama (liste/harita/filtre) | ✅ Çekirdek | |
| Mekan Detay Sayfası | ✅ Çekirdek | |
| Kullanıcı Katkı & Geri Bildirim | ✅ | Rozet/itibar sistemi |
| Gurme Puanı | ✅ (rol bazlı esnek tasarım) | |
| Admin / Kürasyon Paneli | ✅ Çekirdek | |
| Arama İyileştirme (hafif AI) | ✅ Destekleyici katman | Genişletilmiş semantic search |
| Keşif Reels | ❌ | ✅ Faz 2 (telif/operasyon riski nedeniyle ertelendi) |
| Influencer Listeleri | ❌ | ✅ İleri faz |
| B2B akışlar (mekan sahibi) | ❌ | ✅ İleri faz |

Detaylı gereksinimler: [prd.md](prd.md)

## 7. Gelir Modeli

MVP'de gelir modeli **bilinçli olarak açık bırakılmıştır** (NFR-08). Değerlendirilen seçenekler:

1. **Reklam/sponsorluk** — "öne çıkan mekan" alanları; kürasyon tarafsızlığı riski yönetilmeli
2. **Freemium** — premium kullanıcıya özel filtreler ve/veya Gurme Puanı yetkisi
3. **B2B listeleme ücreti** — mekan sahiplerine öne çıkarma/güncelleme paketi

Veri modeli ve mimari, hangi model seçilirse seçilsin sonradan eklenebilecek şekilde esnek tasarlanır (ör. `featured` alanı, rol bazlı yetkiler). Karar Faz 2 başında verilir.

## 8. Başarı Metrikleri (özet)

- **Veri kapsamı:** 3 MVP ilçesinde ilçe başına minimum butik mekan hedefi karşılandı mı
- **Veri doğruluğu:** "bu bilgi yanlış" şikayet oranı / mekan görüntülenme düşük mü
- **Retention proxy:** haftalık ≥1 keşif ekranı dönüşü
- **Katkı oranı:** kullanıcı öneri/düzeltme sayısı zamanla artıyor mu
- **Kürasyon kuyruğu sağlığı:** öneri → yayın süresi hedef eşik altında mı
- **Şehir genişleme hazırlığı:** ikinci şehre geçiş eforu minimum mu

Tam metrik listesi ve eşikler: [prd.md](prd.md)
