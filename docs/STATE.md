# Durum — 2026-07-16

## Aktif plan
Yok — kod yazma turu henüz başlamadı. İki round `idea-red-team` tamamlandı (Codex/GPT-5.6 Sol, high
effort), ikisi de NO-GO. Şu an doğrulama testleri konuşulacak, kod yazılmayacak.

## Şu an ne yapıyoruz
Round 1: proje Codex'e yıktırıldı → NO-GO → kullanıcıyla kapsam daraltıldı (tam menü sistemi, kullanıcı
katkısı, semantic search MVP'den çıkarıldı/Faz 2'ye alındı — bkz. docs/CHANGELOG.md). Round 2: revize
spec tekrar yıktırıldı → **hâlâ NO-GO**. En kritik round 2 bulgusu: ürünün "Instagram → Maps → fiyat"
akışını tek yere toplama vaadi fiilen çalışmıyor — Instagram içeriği alınmıyor, kesin fiyat yok, yorum/
yol tarifi için yine Maps'e çıkılıyor; ürün 4. bir durak ekleme riski taşıyor (= Sorun 7). Ayrıca dağıtım
kanalı (restoran bağlantıları, WhatsApp, SEO) henüz ölçülmüş değil, sadece varsayım (= Sorun 5). 7
sorunun tamamı + her biri için 3-5 çözüm + kullanıcı-perspektifi ürün analizi: docs/RISK-MITIGATION.md.

## Sıradaki adım
Sorun 7 (değer önerisi) ve Sorun 5 (dağıtım) için **kod yazmadan** doğrulama testlerine nasıl
başlanacağını konuş: (a) Sorun 7 → 10 kişilik kronometre testi ("GurmeGo ile" vs "bugünkü IG+Maps
yöntemiyle" mekan bulma süresi), (b) Sorun 5 → landing page + WhatsApp/Instagram bekleme listesiyle
restoran bağlantılarından gerçek ilgi/erişim sayısını ölçmek. Kullanıcı bir sonraki oturuma bu konudan
devam etmek istiyor — henüz hiçbir test tasarımı netleşmedi, sıfırdan planlanacak.

## Bloke olanlar
- Yok.

## Yakın kararlar
- Round 1 pivot tablosu + reddedilen bulgu: docs/CHANGELOG.md (2026-07-16 ilk girdi)
- Round 2 verdikti + sorun→çözüm envanteri + öncelik sırası: docs/RISK-MITIGATION.md

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü sistemi (kalem+fiyat, MVP'de): ELENDİ. Gerekçe: sürekli çürüyen envanter, küçük ekiple
  sürdürülemez. KOŞULLU — kürasyon ekibi büyür veya mekan-sahibi-girişi (Faz 2) aktif olursa yeniden aç.
- Semantic search/pgvector (MVP'de): ELENDİ → Faz 2'ye alındı. Round 2'de "ÇÖZÜLDÜ" diye doğrulandı.
  KALICI — tekrar önerme.
- "Butik" tanımını salt şube-sayısı DB kuralına dayandırmak: ELENDİ, gerçek dünya kategorisine
  (IG/TikTok'ta dolaşan, ≤3 şube) çevrildi. KISMİ ÇÖZÜM — round 2: "keyfilik DB'den küratör takdirine
  taşındı", hâlâ ölçülebilir değil (bkz. RISK-MITIGATION.md Sorun 3).
- Kullanıcı katkısı (yeni mekan/düzeltme) MVP'de: ELENDİ → Faz 2'ye alındı. NOT: yorum/puanlama/Gurme
  Puanı hâlâ MVP'de, aynı cold-start riskini taşıyor — henüz elenmedi (Sorun 2, çözülmedi).
- "3-4 adımı tek yere toplama" iddiası (mevcut mimariyle): Round 2'de ÇÜRÜTÜLDÜ — yol tarifi/yorumlar
  hâlâ Maps'e çıkıyor, Instagram içeriği yok. KOŞULLU — Sorun 7 çözümleri (uygulama içi harita, IG
  bağlantısı, Google puan özeti) uygulanırsa yeniden değerlendirilebilir.
