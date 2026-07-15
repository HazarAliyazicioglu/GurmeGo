# Durum — 2026-07-16

## Veri sınırı
Kurumsal repo değil (kişisel proje). Codex/GLM delegasyonu serbest.

## Aktif plan
Yok — henüz kod yazma turu başlamadı. Şu an spec revizyonu aşamasındayız (red-team sonrası pivot).

## Şu an ne yapıyoruz
`idea-red-team` skill'i ile projeyi Codex'e (GPT-5.6 Sol, high effort) yıktırdık. Verdikt: **NO-GO**
(orijinal haliyle). Kullanıcı bulguların çoğunu kabul edip kapsamı önemli ölçüde daralttı: menü/fiyat
sistemi yerine fiyat aralığı + favori ürünler, "butik" tanımı netleşti (zincir değil, ≤2-3 şube,
IG/TikTok'ta dolaşan yerler), kullanıcı katkısı ve mekan-sahibi-girişi Faz 2'ye alındı, WhatsApp paylaşım
özelliği eklendi, Google yorumları deep-link ile kullanılacak (API entegrasyonu yok). Semantic
search/pgvector'ın MVP'den çıkarılıp çıkarılmayacağı kullanıcıya soruldu, cevap bekleniyor. Kararlar
netleşince prd.md/product-overview.md/architecture.md/rule-engine.md güncellenecek.

## Sıradaki adım
Kullanıcının semantic search kararını al, sonra docs/*.md dosyalarını pivot kararlarına göre güncelle.

## Bloke olanlar
- Semantic search MVP'de kalsın mı kararı bekleniyor.

## Yakın kararlar
- Red-team verdikti ve kabul/ret listesi: docs/CHANGELOG.md (2026-07-16 girdisi)

## Denenmiş ve ELENMİŞ yaklaşımlar
- Tam menü sistemi (kalem+fiyat, MVP'de): ELENDİ. Gerekçe: Codex — sürekli çürüyen envanter, tek
  kişi/küçük ekiple sürdürülemez (ayda 38-75 saat sadece güncellik kontrolü). KOŞULLU — kürasyon ekibi
  büyür veya restoran-sahibi-girişi (Faz 2) aktif olursa yeniden değerlendir.
- Semantic search/pgvector (MVP'de, ilk tasarım): SORGULANIYOR. Gerekçe: Codex — birkaç yüz mekanlık
  veri setinde gereksiz karmaşıklık ("mühendislik kostümü"). Kullanıcı kararı bekleniyor.
- "Butik" tanımını salt DB kuralına (şube sayısı ≤4) dayandırmak: ELENDİ. Gerekçe: kullanıcı açısından
  anlamsız/keyfi. KALICI — artık gerçek dünya kategorisi (IG/TikTok'ta dolaşan, ≤2-3 şubeli yerler) ile
  tanımlanıyor, eşik hâlâ config'te ama tanım daha isabetli.
