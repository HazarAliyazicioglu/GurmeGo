# GurmeGo — Product Overview

**Versiyon:** 2.0 (red-team sonrası revize) · **Sahip:** Hazar · **Tarih:** 2026-07-16 · **Durum:** Onaylı

Değişiklik geçmişi ve gerekçeler: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16 girdisi.

---

## 1. Vizyon & Elevator Pitch

GurmeGo, şehirlerin ilçelerinde saklı kalmış **butik ve özel yemek mekanlarını** (zincirler ve
franchise'lar hariç — Instagram/TikTok'ta mekan önerisi olarak dolaşan, en fazla 2-3 şubeli yerler),
konum, ulaşım, fiyat aralığı ve favori ürün bilgisiyle **tek yerden, kolayca** keşfetmeni sağlayan
mobil öncelikli platformdur.

> **Tek cümle:** "Semtindeki gerçek butik mekanı; fiyatı ve nasıl gideceğinle birlikte, tek uygulamadan bulan platform."

**Değer önerisi üç sütun üzerine kurulu:**

1. **Kürasyon** — zincirler dışlanır, her mekan editöryal süzgeçten geçer; "herkesin bildiği yer" değil "gerçek keşif". Butik tanımı gerçek dünya kategorisine dayanır (bkz. [rule-engine.md §1](rule-engine.md)).
2. **Tek yerden git kolaylığı** — bugün mekanı Instagram'da görüp Maps'te doğrulayıp fiyatı ayrı yerden öğrenmek gereken 3-4 adımlık akışı tek ekranda toplar: fiyat aralığı, favori ürünler, ulaşım notu, çalışma saatleri, kategoriye göre rota. (Tam menü sistemi Faz 2 — bkz. §6.)
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
| Google Maps | Kapsam, konum/yol tarifi | Kürasyon yok; zincir/butik ayrımı yok; fiyat aralığı eksik |
| Yelp / TripAdvisor | Yorum hacmi | TR'de zayıf yerelleşme; butik kürasyonu yok |
| Instagram / TikTok | Keşif ilhamı, görsellik | Yapısal veri yok; dağınık, tekrar bulunamaz |
| Menüde Ne Var / Menülen / HepMenu | Menü+fiyat verisi, TR'de mevcut | Butik/zincir ayrımı yok; kürasyon zayıf/yok; ilçe bazlı derinlik yok |
| Cafinder | Kafe keşfi + puanlama | Kategori dar (kafe); menü/fiyat derinliği yok |

**Not (2026-07-16 red-team sonrası):** "Kimsenin doldurmadığı boşluk" iddiası doğru değil — yukarıdaki
3 uygulama (Menüde Ne Var, Menülen, HepMenu) aynı kesişimi (menü+fiyat+keşif) zaten hedefliyor. Bkz.
[docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16. GurmeGo'nun **gerçek** farkı artık "yeni veri kaynağı"
değil, konumlanma: kullanıcının zaten yaptığı "Instagram'da gör → Maps'te doğrula → fiyatı ayrı yerden
öğren" 3-4 adımlık akışı **tek yerde toplamak + kategoriye göre rota oluşturmak** (bkz. §6 MVP Kapsamı).
Bu farkın gerçekten yeterli olduğu henüz doğrulanmadı — MVP doğrulama eşiği için [prd.md §5](prd.md)
altındaki metriklere bakın.

GurmeGo dördünün kesişimindedir. **Savunulabilir fark (revize):** kürasyon + ilçe bazlı odak + "tek
yerden git" kolaylığı + kategori bazlı rota + sosyal paylaşım (WhatsApp). Yapısal veri derinliği iddiası
MVP'de zayıflatıldı (tam menü yerine fiyat aralığı + favori ürünler) — bu artık ayırt edici bir üstünlük
değil, rakiplerle asgari düzeyde eşleşme.

## 5. Platform Stratejisi

**Mobil önce, web SEO destek:**

- **React Native mobil uygulama** = ana deneyim (konum bazlı keşif, harita, favoriler)
- **Next.js web (SSR/SSG)** = mekan sayfaları Google'da indekslenir → organik keşif kanalı; app'e yönlendirme hunisi
- Tek backend/API iki istemciyi besler (bkz. [architecture.md](architecture.md))

## 6. MVP Kapsamı

**Coğrafi kapsam:** İstanbul — **Kadıköy, Beşiktaş, Beyoğlu** (butik mekan yoğunluğu en yüksek 3 ilçe). Veri modeli şehir-agnostik; ikinci şehre geçiş minimum mühendislik değişikliğiyle.

**Mekan sayısı:** ~225 hedefi (3×75) **düşürüldü** — kesin sayı kürasyon ekibinin (Hazar + 1-2 kişi)
ayırabileceği haftalık kürasyon süresine göre belirlenecek (bkz. [docs/CHANGELOG.md](CHANGELOG.md)
2026-07-16, madde 2). Artış Faz 2'ye bırakılıyor.

**Zamanlama:** 3-4 ay agresif MVP. Bu ufuk kapsam disiplinini zorunlu kılar — çekirdek dışı her şey Faz 2/3'e.

### Modüller

| Modül | MVP | Faz 2 | Faz 3 |
|---|---|---|---|
| Mekan Veri Modeli & Kürasyon Sistemi (fiyat aralığı + favori ürünler) | ✅ Çekirdek | Tam menü sistemi (kalem+fiyat) | |
| Keşif & Arama (liste/harita/yapısal filtre + kategori bazlı rota) | ✅ Çekirdek | | |
| Mekan Detay Sayfası (+ Google yorumlarına deep-link, + WhatsApp paylaşım) | ✅ Çekirdek | | |
| Yorum/Puan (kendi review sistemi) | ✅ | | |
| Kullanıcı Katkı (yeni mekan önerisi, düzeltme) | ❌ | ✅ Faz 2 | |
| Mekan sahibi kendi bilgisini girme | ❌ | ✅ Faz 2 | |
| Rozet/itibar sistemi | ❌ | ✅ Faz 2 | |
| Gurme Puanı | ✅ (rol bazlı esnek tasarım) | | |
| Admin / Kürasyon Paneli | ✅ Çekirdek | | |
| Arama İyileştirme (doğal dil → filtre + semantic search) | ❌ | | ✅ Faz 3 |
| Keşif Reels | ❌ | ✅ Faz 2 (telif/operasyon riski nedeniyle ertelendi) | |
| Influencer Listeleri | ❌ | | ✅ İleri faz |
| B2B akışlar (mekan sahibi paneli, ücretli) | ❌ | | ✅ İleri faz |

**Not:** "Arama İyileştirme" MVP'de yapısal filtrelerle (kategori/fiyat/ilçe/mesafe) tamamen çalışır,
AI katmanı yok — bkz. [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-16 madde 9 ve [architecture.md §6](architecture.md).

Detaylı gereksinimler: [prd.md](prd.md)

## 7. Gelir Modeli

MVP'de gelir modeli **bilinçli olarak açık bırakılmıştır** (NFR-08). Değerlendirilen seçenekler:

1. **Reklam/sponsorluk** — "öne çıkan mekan" alanları; kürasyon tarafsızlığı riski yönetilmeli
2. **Freemium** — premium kullanıcıya özel filtreler ve/veya Gurme Puanı yetkisi. Kullanıcı bu yönü
   tercih ediyor ancak **hangi özelliklerin premium'a gireceğine dair henüz bir sistem/tasarım yok** —
   AK-03 kapsamında netleştirilmesi gerekiyor.
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
