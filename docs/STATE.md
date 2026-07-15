# Durum — 2026-07-16

## Veri sınırı
Kurumsal repo değil (kişisel proje). Codex/GLM delegasyonu serbest.

## Aktif plan
Yok — henüz kod yazma turu başlamadı. İki round red-team tamamlandı, ikisi de NO-GO. Sıradaki karar
kullanıcının: RISK-MITIGATION.md'deki çözümlerden hangilerini uygulayıp round 3'e mi geçilecek, yoksa
başka bir yöne mi gidilecek.

## Şu an ne yapıyoruz
Round 1: `idea-red-team` ile proje Codex'e yıktırıldı → NO-GO. Kullanıcıyla kapsam daraltıldı (tam
değişiklik listesi: docs/CHANGELOG.md). Round 2: revize spec tekrar Codex'e yıktırıldı → **hâlâ NO-GO**,
ama belirgin ilerleme var (round 1'in 6 sorunundan 1'i tam, 3'ü kısmen çözüldü). Yeni ve en temel sorun:
ürünün "3-4 adımı tek yere toplama" vaadi gerçekte çalışmıyor (Instagram içeriği alınmıyor, kesin fiyat
yok, yorum/yol tarifi için Maps'e çıkılıyor) — ürün mevcut akışı kısaltmak yerine 4. bir durak ekleme
riski taşıyor. 7 açık sorunun her biri için 3-5 çözüm + kullanıcı-perspektifinden ürün analizi yazıldı:
docs/RISK-MITIGATION.md.

## Sıradaki adım
Kullanıcıyla docs/RISK-MITIGATION.md'deki çözümleri gözden geçir, hangilerinin uygulanacağına karar ver.
Öncelik önerisi: Sorun 7 (değer önerisi — kod yazmadan kronometre testiyle doğrulanabilir) → Sorun 5
(dağıtım — landing page/bekleme listesiyle kodsuz test edilebilir) → Sorun 1 (kapasite) → geri kalanlar.

## Bloke olanlar
- Yok — ama round 3 red-team'e geçmeden önce en az Sorun 7 ve Sorun 5'in bir şekilde ele alınması
  önerilir (kod yazmaya başlamadan önce).

## Yakın kararlar
- Round 1 pivot tablosu ve reddedilen bulgu: docs/CHANGELOG.md (2026-07-16 ilk girdi)
- Round 2 verdikti ve sorun→çözüm envanteri: docs/RISK-MITIGATION.md

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü sistemi (kalem+fiyat, MVP'de): ELENDİ. Gerekçe: Codex — sürekli çürüyen envanter, tek
  kişi/küçük ekiple sürdürülemez. KOŞULLU — kürasyon ekibi büyür veya restoran-sahibi-girişi (Faz 2)
  aktif olursa yeniden değerlendir.
- Semantic search/pgvector (MVP'de, ilk tasarım): ELENDİ → Faz 2'ye alındı. Gerekçe: Codex — birkaç yüz
  mekanlık veri setinde gereksiz karmaşıklık; round 2'de bu karar "ÇÖZÜLDÜ" olarak doğrulandı. KALICI
  (round 2 onayladı).
- "Butik" tanımını salt DB kuralına (şube sayısı ≤4) dayandırmak: ELENDİ. Gerekçe: kullanıcı açısından
  anlamsız/keyfi. KISMİ — round 2'de "keyfilik DB'den küratör takdirine taşındı" eleştirisi geldi,
  hâlâ tam çözülmedi (bkz. RISK-MITIGATION.md Sorun 3).
- Kullanıcı katkısını (yeni mekan/düzeltme) MVP'de açık tutmak: ELENDİ → Faz 2'ye alındı. KOŞULLU —
  kullanıcı tabanı oluşunca yeniden aç. NOT: yorum/puanlama/Gurme Puanı hâlâ MVP'de ve aynı cold-start
  sorununu taşıyor (round 2 tespiti, henüz elenmedi — bkz. RISK-MITIGATION.md Sorun 2).
- Google yorumlarını Places API ile uygulama içinde göstermek: ELENDİ, deep-link ile değiştirildi.
  KOŞULLU — round 2 bunun "yorumlara bakmak için dışarı çıkma" sorununa katkıda bulunduğunu işaret etti;
  en azından rating+sayı özeti gösterme seçeneği RISK-MITIGATION.md'de yeniden öneriliyor.
- "3-4 adımı tek yere toplama" pazarlama iddiası (mevcut haliyle): Round 2'de ÇÜRÜTÜLDÜ — ürün mimarisi
  bu iddiayı desteklemiyor (yol tarifi ve yorumlar hâlâ Maps'e çıkıyor, Instagram içeriği yok). KOŞULLU
  — RISK-MITIGATION.md Sorun 7'deki çözümler uygulanırsa yeniden değerlendirilebilir.
