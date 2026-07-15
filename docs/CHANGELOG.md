# GurmeGo — Changelog

Bu dosya spec/karar seviyesindeki değişiklikleri kaydeder (kod değişikliği henüz yok). Her girdi:
ne değişti, neyle değiştirildi, neden. En yeni en üstte.

---

## 2026-07-16 — Red-team pivotu: kapsam daraltma

### Bağlam
`idea-red-team` skill'i ile proje Codex'e (GPT-5.6 Sol, `model_reasoning_effort=high`) yıktırıldı.
Orijinal spec seti (2026-07-06, hiç kod yazılmadan 10 gün bekleyen 8 doküman) için verdikt: **NO-GO**.

**Codex'in gerekçesi (özet):** Düşük frekanslı bir keşif davranışını, gelir modeli olmayan ve tek
kişinin sürdüremeyeceği manuel veri operasyonuyla çözmeye çalışıyordu. Ölüm senaryoları: %45 proje
hiç ürüne dönüşmez (mimari tasarım hazzına kaymış), %35 ürün çıkar ama alışkanlık oluşmaz, %15 kullanım
gelir ama veri çürür. En riskli teknik parça AI/harita değil, menü/fiyat güncellik operasyonuydu (225
mekan için tahmini ayda 38-75 saat sadece doğrulama). Ayrıca aynı boşluğu hedefleyen dört rakip
bulundu: Menüde Ne Var, Menülen, HepMenu, Cafinder.

### Değişiklikler

| # | Neydi | Ne oldu | Neden |
|---|---|---|---|
| 1 | "Butik" tanımı: yalnızca `branch_count ≤ eşik` DB kuralı | Gerçek dünya kategorisi: zincir değil, ≤2-3 şube, Instagram/TikTok'ta mekan önerisi olarak dolaşan yerler (Burger King/Starbucks/Simit Sarayı gibi zincirlerin karşıtı) | Codex: eşik kullanıcı için anlamsız/keyfiydi, tanım kullanıcıya değil kurucunun sınıflandırmasına dayanıyordu |
| 2 | MVP hedefi: 3 ilçe × ~75 mekan = ~225 mekan | Sayı azaltılacak (kesin eşik henüz belirlenmedi); artış Faz 2'ye bırakılıyor | Codex: 225 kayıt tek kişi/küçük ekip için sürdürülemez bir editöryal yük |
| 3 | Tam menü sistemi (kalem + fiyat, MVP'de FR-MV-01/FR-MD-01) | Ortalama fiyat aralığı (₺/₺₺/₺₺₺) + "favori ürünler" alanı; tam menü sistemi ileri faza | Codex: menü/fiyat sürekli çürüyen envanter, en pahalı bakım kalemi. Bu, "en riskli teknik parça" bulgusuna doğrudan cevap |
| 4 | Kullanıcı katkısı MVP'de aktif (FR-KG-01/02) | Kullanıcı katkısı **ve** mekan-sahibi-kendi-bilgisini-girme akışı ileri faza alındı; MVP verisi kürasyon ekibinden | Codex: kullanıcı katkısı MVP'de çalışmaz döngüsü (katkı için kullanıcı lazım, kullanıcı için güvenilir veri lazım) |
| 5 | Ürün konumlanması: yeni bir keşif alışkanlığı yaratmak | Konumlanma değişti: TikTok/Instagram/Maps arasında gezinme alışkanlığını kırmak değil, "3-4 uygulama yerine tek yerden git" — kolaylaştırma/köprü | Codex: kullanıcı zaten IG/TikTok'tan Maps'e geçiyor, bu geçişi kırmak yeterince acı değildi |
| 6 | (yoktu) | Kategori bazlı rota: kullanıcı "tatlı" veya "kahve" seçtiğinde o kategorideki mekanlara filtre + yol tarifi | Konumlanma değişikliğinin doğal uzantısı |
| 7 | (yoktu) | WhatsApp paylaşım özelliği: kullanıcılar beğendikleri mekanı birbirine uygulama içinden gönderebilecek | Organik dağıtım/viral büyüme mekanizması eksikti (Codex: "bilinmeyenler" listesinde işaretlenmişti) |
| 8 | Kendi review sistemi (Review modeli), Google yorumları hiç yok | Google yorumlarına **deep-link** (Maps'e yönlendirme); Places API entegrasyonu yok | API'nin ToS kısıtları (attribution zorunlu, review metni 30 günden fazla cache'lenemez, ücretli istek) MVP'de gereksiz risk/maliyet. Kendi review sistemi FR-MD-02 olarak duruyor, ek olarak Google'a link veriliyor |
| 9 | Semantic search/pgvector MVP'de (FR-AI-02) | **Faz 2'ye alındı** (düzeltme: ilk yazımda "Faz 3" denmişti, kullanıcı "Faz 2" demek istediğini belirtti — ayrı bir Faz 3 katmanı yok, MVP → Faz 2 → İleri faz yapısı korunuyor). MVP arama tamamen yapısal filtre (kategori/fiyat/ilçe/mesafe), AI/pgvector/LLM çağrısı yok | Codex: birkaç yüz mekanlık veri setinde gereksiz karmaşıklık ("mühendislik kostümü"); kullanıcı en basit seçeneği (sadece yapısal filtre) onayladı |
| 10 | Gelir modeli tamamen açık | **Hâlâ açık** — freemium fikri beğenildi ama "o mantığa uyan bir sistem yok" (kullanıcı notu) | Codex: gelir modelinin "ertelenmesi" değil ürün mantığından çıkarılmış olması eleştirisi kısmen geçerliliğini koruyor |
| 11 | Kürasyon ekibi büyüklüğü belirtilmemiş | Netleşti: kullanıcı + 1-2 kişi daha | Codex'in "tek kişi sürdüremez" bulgusuna kısmi cevap — hâlâ küçük ekip, ama MVP kapsamı azaltılan mekan sayısıyla dengeleniyor |
| 12 | İlk kullanıcı kitlesi kaynağı belirtilmemiş | Netleşti: mevcut restoran/mekan bağlantıları + organik/SEO büyüme | Codex'in "dağıtım kanalı dokümanda yok, bu da olumsuz sinyal" bulgusuna cevap |

### Red-team bulguları — reddedilenler

- **"Gereksiz kılan çözüm var" (Menüde Ne Var, Menülen, HepMenu, Cafinder aynı boşluğu hedefliyor):**
  kısmen reddedildi. Gerekçe: konumlanma değişikliğiyle (kolaylaştırma/köprü + kategori bazlı rota +
  WhatsApp paylaşım + restoran bağlantıları üzerinden dağıtım) farklılaşma iddiası hâlâ var, ama bu
  rakiplere karşı nasıl kazanılacağı henüz test edilmedi. **Bu yanlışsa ne olur:** ürün yine "daha küçük
  veri tabanıyla aynı savaşa giren geç bir kopya" olarak kalır — rakip karşılaştırması yapılmadan MVP'ye
  girilirse aynı ölüm senaryosuna (%35, alışkanlık oluşmaz) düşme riski sürer.

### Uygulanan doküman güncellemeleri

Yukarıdaki tablonun tamamı şu dosyalara işlendi: `product-overview.md`, `prd.md`, `architecture.md`,
`rule-engine.md`, `api-spec.md`, `ai-prompt-design.md` (Faz 2 referansı olarak işaretlendi, silinmedi),
`infrastructure.md` (maliyet tablosundan AI kalemleri çıkarıldı), `development-guidelines.md` (test
stratejisi güncellendi).

### Sonraki adım
MVP mekan sayısı hedefi (~225 yerine ne kadar) netleşince `prd.md §1`'e yazılacak. Ardından ilk kod
turu: `architecture.md §3`'teki monorepo iskeleti.

---

## 2026-07-16 (devam) — Round 2 red-team + kullanıcı-perspektifi analizi

Kullanıcı isteği: kapsam güncellemeleri tamamlandıktan sonra projeyi Codex'e **tekrar** yıktır. Hâlâ
NO-GO ise, her bir sorun için 3-5 çözüm üret ve kaydet. Ayrıca kullanıcı yerine geçip ürünle ilgili
eksik/geliştirilebilir noktaları ayrıca değerlendir.

**Verdikt: hâlâ NO-GO**, ama round 1'e göre belirgin ilerleme var. Codex'in özeti: *"Uygulama ve bakım
riski ciddi ölçüde düştü, fakat çekirdek kullanıcı değeri ile tekrarlanabilir dağıtım hâlâ kanıtlanmadı;
mevcut tasarım 'tek yer' vaadini fiilen yerine getirmiyor."*

Round 1'in 6 eleştirisinden: 1 tanesi (semantic search) tam çözüldü, 3 tanesi (kapasite, UGC cold-start,
butik tanımı) kısmen çözüldü, 2 tanesi (rekabet, dağıtım) çözülmedi. Ayrıca yeni ve en temel bir sorun
ortaya çıktı: ürünün "Instagram → Maps → fiyat akışını tek yere toplama" iddiası gerçekte doğru değil —
Instagram içeriği alınmıyor, kesin fiyat yok, yorum/yol tarifi için yine Maps'e çıkılıyor. Ürün mevcut
3 adımı kısaltmak yerine 4. bir durak ekleme riski taşıyor.

7 sorunun her biri için 3-5 somut çözüm + öncelik sırası + kullanıcı-perspektifinden eksik/fazla analizi:
**[docs/RISK-MITIGATION.md](RISK-MITIGATION.md)**.

Henüz hangi çözümlerin uygulanacağına karar verilmedi — bu kullanıcıyla birlikte yapılacak sıradaki adım.
