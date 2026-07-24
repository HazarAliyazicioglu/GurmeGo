# GurmeGo — Product Overview

**Versiyon:** 3.0 (round 3 panel + Codex koşullu-GO sonrası revize) · **Sahip:** Hazar · **Tarih:** 2026-07-24 · **Durum:** Koşullu-GO — pilot karar sözleşmesi geçerli ([prd.md §5](prd.md))

Değişiklik geçmişi ve gerekçeler: [docs/CHANGELOG.md](CHANGELOG.md) 2026-07-24 girdisi.

---

## 1. Vizyon & Elevator Pitch

GurmeGo, İstanbul'un butik ve özel yemek mekanları için **rehber** (Michelin/Time Out tarzı, az sayıda
seçici, imzalı öneri) — zincirler ve franchise'lar hariç (Instagram/TikTok'ta mekan önerisi olarak
dolaşan, en fazla 2-3 şubeli yerler). Google Maps'in yerini almaz; **karar aşamasını hızlandıran**,
kürasyon ekibinin "neden burayı seçtik" dediği bir katman.

> **Tek cümle:** "Semtindeki gerçek butik mekanı, kürasyon ekibinin imzasıyla — fiyatını ve nasıl gideceğini bil, kararını hızlandır."

**Değer önerisi iki sütun üzerine kurulu** (2026-07-24: "tek yerden git" iddiası round 3'te çürütüldüğü
için üç sütundan ikiye indirildi — bkz. [docs/RISK-MITIGATION.md](RISK-MITIGATION.md) Sorun 7):

1. **Kürasyon / editöryal seçicilik** — zincirler dışlanır, her mekan imzalı bir editöryal notla yayınlanır; "herkesin bildiği yer" değil "gerçek keşif". Butik tanımı gerçek dünya kategorisine dayanır (bkz. [rule-engine.md §1](rule-engine.md)). Bu, Google'a karşı tek gerçek savunulabilir fark — veri hacmi değil.
2. **İlçe bazlı yerel odak** — şehir geneli değil, "bulunduğum ilçedeki butik kahvaltıcılar" derinliğinde keşif.

**Değişmeyen ama küçültülmüş vaat:** yol tarifi ve Google puanları için kullanıcı yine Maps'e çıkar —
GurmeGo bunu gizlemez, tam tersine mekan kartında Google puanı özet rozeti + tek dokunuşla deep-link
sunarak bu geçişi en hızlı hale getirir. "3-4 adımı tek yere topluyoruz" iddiası artık kullanılmıyor.

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

**Not (2026-07-24, round 3 sonrası):** "Kimsenin doldurmadığı boşluk" iddiası doğru değil — yukarıdaki
3 uygulama (Menüde Ne Var, Menülen, HepMenu) aynı kesişimi (menü+fiyat+keşif) zaten hedefliyor. "Tek
yerden toplama" iddiası da round 3'te çürütüldü: yol tarifi ve yorumlar için kullanıcı yine Maps'e
çıkıyor, bu gizlenmiyor artık. GurmeGo'nun **gerçek** farkı veri hacmi ya da kapsayıcılık değil,
**editöryal seçicilik** — Google'ın yapısal olarak yapamayacağı, az sayıda mekana insan kararıyla
"evet" demek. Bu farkın yeterli olduğu henüz doğrulanmadı — Pilot Karar Sözleşmesi için
[prd.md §5](prd.md)'e bakın.

GurmeGo dördünün kesişimindedir. **Savunulabilir fark (revize 2026-07-24):** kürasyon/rehber
konumlanması + ilçe bazlı odak + kategori bazlı rota + sosyal paylaşım (WhatsApp). Yapısal veri
derinliği iddiası MVP'de zayıflatıldı (tam menü yerine fiyat aralığı + favori ürünler) — bu artık ayırt
edici bir üstünlük değil, rakiplerle asgari düzeyde eşleşme.

## 5. Platform Stratejisi (revize 2026-07-24)

**Web/PWA öncelikli pilot, mobil doğrulama sonrası:**

- **Next.js web (SSR/SSG + PWA)** = MVP'de **tek istemci** ve ana deneyim (konum bazlı keşif, harita,
  favoriler) — hem SEO/organik keşif kanalı hem gerçek kullanım deneyimi aynı codebase'de.
- **React Native mobil uygulama** = Faz 2. Pilot Karar Sözleşmesi'nin (bkz. [prd.md §5](prd.md)) eşikleri
  karşılanınca devreye girer — talep doğrulanmadan iki platform bakım yükü/App Store onay riski alınmaz.
- Tek backend/API, istemci sayısı artınca da değişmeden kalır (bkz. [architecture.md](architecture.md)).

## 6. MVP Kapsamı

**Coğrafi kapsam:** İstanbul — **Kadıköy, Beşiktaş, Beyoğlu** (butik mekan yoğunluğu en yüksek 3 ilçe). Veri modeli şehir-agnostik; ikinci şehre geçiş minimum mühendislik değişikliğiyle.

**Mekan sayısı:** **30-45 mekan** (ilçe başına ~10-15), Codex round 3 Pilot Karar Sözleşmesi'nin parçası
(bkz. [prd.md §5](prd.md)) — kesin, sabit, öncesinde belirlenmiş bir eşik; sonradan ölçülüp ayarlanacak
bir tahmin değil.

**Zamanlama:** 6 haftalık gerçek kullanıcı pilotu (Pilot Karar Sözleşmesi). Bu ufuk kapsam disiplinini
zorunlu kılar — çekirdek dışı her şey Faz 2'ye.

### Modüller (revize 2026-07-24)

| Modül | MVP (pilot) | Faz 2 |
|---|---|---|
| Mekan Veri Modeli & Kürasyon Sistemi (fiyat aralığı + favori ürünler) | ✅ Çekirdek | Tam menü sistemi (kalem+fiyat) |
| Keşif & Arama (liste/harita/yapısal filtre + kategori bazlı rota) | ✅ Çekirdek | Arama iyileştirme: doğal dil → filtre + semantic search |
| Mekan Detay Sayfası (+ Google puanı özet rozeti + deep-link, + WhatsApp paylaşım) | ✅ Çekirdek | |
| İmzalı editöryal öneri (kürasyon notu) | ✅ Çekirdek | |
| Yorum/Puan (kullanıcı review sistemi) | ❌ | ✅ |
| Gurme Puanı | ❌ | ✅ (AK-01 kararı Faz 2'de verilir) |
| Mekan sahibi doğrulama/itiraz akışı | ❌ (bkz. [prd.md §1](prd.md) madde 4 — koşullu sınır) | ✅ |
| Kullanıcı Katkı (yeni mekan önerisi, düzeltme) | ❌ | ✅ |
| Mekan sahibi kendi bilgisini girme | ❌ | ✅ |
| Rozet/itibar sistemi | ❌ | ✅ |
| React Native mobil uygulama | ❌ | ✅ (Pilot Karar Sözleşmesi eşikleri karşılanınca) |
| Admin / Kürasyon Paneli | ✅ Çekirdek | |
| Keşif Reels | ❌ | ✅ (telif/operasyon riski nedeniyle ertelendi) |
| Influencer Listeleri | ❌ | İleri faz |
| B2B akışlar (mekan sahibi paneli, ücretli) | ❌ | İleri faz |

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

## 8. Başarı Metrikleri (özet — 2026-07-24 revize)

MVP artık ayrı bir "belki doğrulanır" ürünü değil, doğrudan Pilot Karar Sözleşmesi ile ölçülen bir deney:

- **Kapsam:** 30-45 mekan, 6 hafta (sabit — sonradan gevşetilmez)
- **Kullanıcı edinimi:** ≥150 hedef kullanıcı
- **Karar davranışı:** ≥%25 Maps'e gitme/kaydetme/paylaşma
- **4. hafta geri dönüş:** aktif kullanıcıların ≥%20'si
- **Veri uyuşmazlığı / bakım yükü:** <%5 / ayda <30 insan-saat

Tam metrik listesi, eşikler ve "eşikler karşılanmazsa ne olur": [prd.md §5](prd.md)
