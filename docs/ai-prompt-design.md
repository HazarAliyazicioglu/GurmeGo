# GurmeGo — AI Prompt Design

**Versiyon:** 1.0 · **Tarih:** 2026-07-06 · **Durum: Faz 3 (MVP kapsamında değil)**

> **2026-07-16 not:** Bu doküman `idea-red-team` sonrası MVP'den çıkarıldı — Codex'in tespiti, birkaç
> yüz mekanlık MVP veri hacminde semantic search/pgvector'ın gereksiz karmaşıklık olduğuydu. MVP'de
> arama tamamen yapısal filtrelerle (kategori/fiyat/ilçe/mesafe) çalışır. Bu doküman **referans olarak
> saklanıyor** — Faz 3'te arama iyileştirme gerçekten gerekli görülürse (bkz. [prd.md §5](prd.md)
> MVP doğrulama eşiği) buradaki tasarım baz alınır. Gerekçe: [docs/CHANGELOG.md](CHANGELOG.md)
> 2026-07-16 madde 9.

AI **destekleyici katman** (FR-AI-03): çekirdek keşif AI olmadan tam çalışır. Bu doküman doğal dil arama + semantic search tasarımını kapsar.

İlgili: [architecture.md §6](architecture.md) · [api-spec.md](api-spec.md)

---

## 1. Model Seçimi & Maliyet Disiplini (NFR-05)

| Görev | Model | Gerekçe |
|---|---|---|
| Sorgu → filtre çıkarımı | **claude-haiku-4-5** | Hızlı, ucuz, TR anlama güçlü, JSON/tool-use güvenilir; dar görev için yeterli |
| Embedding | **OpenAI text-embedding-3-small** (1536d) | $0.02/1M token; TR performansı iyi; mekan hacmi küçük → maliyet önemsiz |

- Model id'leri config'te (`AI_SEARCH_MODEL`, `AI_EMBED_MODEL`); maliyet/kalite değişince tek satır (PRD teknik karar #5).
- `max_tokens` düşük tutulur (filtre çıkarımı ≤ 500); streaming gerekmez.
- Maliyet tavanı: aylık AI harcaması toplam altyapının hedef payını aşarsa alarm ([infrastructure.md](infrastructure.md) izleme).
- Rate limit: NL arama kullanıcı başına 30/gün, anonim 10/gün IP ([api-spec.md §6](api-spec.md)).

## 2. Doğal Dil Arama → Yapısal Filtre (FR-AI-01)

### Akış

```
"yakınımda ucuz butik kahvaltıcı"
        │
        ▼  (1) cache kontrol — normalize sorgu anahtarı
        ▼  (2) Haiku çağrısı — tool-use ile filtre çıkarımı
        ▼  (3) çıkan filtreler → mevcut /venues SQL sorgusu (PostGIS dahil)
        ▼  (4) opsiyonel: semantic skorla harmanla (§3)
        ▼  (5) yanıt + interpreted_filters (şeffaflık)
```

### Tool şeması (Haiku tool-use — serbest JSON değil, şema zorlamalı)

```json
{
  "name": "extract_search_filters",
  "input_schema": {
    "type": "object",
    "properties": {
      "category":      { "type": "string", "enum": ["kahvalti", "kafe", "restoran", "tatli", "..."] },
      "cuisine":       { "type": "string" },
      "price_range":   { "type": "string", "enum": ["₺", "₺₺", "₺₺₺", "₺₺₺₺"] },
      "near_me":       { "type": "boolean" },
      "district":      { "type": "string" },
      "open_now":      { "type": "boolean" },
      "is_boutique":   { "type": "boolean" },
      "semantic_terms":{ "type": "array", "items": { "type": "string" },
                         "description": "Yapısal filtreye çevrilemeyen nitelikler: 'sakin', 'çalışmaya uygun', 'deniz manzaralı'" }
    }
  }
}
```

### System prompt (özet şablon)

```
Sen GurmeGo'nun arama yorumlayıcısısın. Kullanıcının Türkçe restoran arama
sorgusunu extract_search_filters aracıyla yapısal filtrelere çevir.
Kurallar:
- "ucuz" → price_range "₺" veya "₺₺"; "pahalı/lüks" → "₺₺₺₺"
- "yakınımda/buralarda" → near_me: true
- İlçe/semt adı geçiyorsa district alanına yaz (örn. "Moda" → Kadıköy)
- Atmosfer/nitelik ifadelerini (sakin, romantik, çalışılır) semantic_terms'e koy
- Emin olmadığın alanı BOŞ bırak; asla tahmin uydurma
- Yemekle ilgisiz sorgu ise hiçbir alan doldurma
```

- Kullanıcı sorgusu ayrı user mesajında, system prompt'a interpolate edilmez (prompt injection yüzeyi küçülür). Çıktı yalnızca whitelisted enum/alan olarak işlenir; serbest metin SQL'e girmez.
- `near_me` → istemcinin gönderdiği lat/lng kullanılır; koordinat LLM'e **gönderilmez** (NFR-04).

## 3. Semantic Search (FR-AI-02)

- **Kaynak metin:** `editorial_note` + kategori + semt + menü özetinden oluşan tek doküman; mekan başına 1 embedding (`Venue.embedding`, pgvector).
- **Güncelleme:** editorial_note veya menü değişince (kürasyon onayı sonrası hook) yeniden embed edilir — event bazlı, cron değil.
- **Sorgu tarafı:** `semantic_terms` doluysa terimler embed edilir → `embedding <=> query` cosine ile skorlanır.
- **Harmanlama:** yapısal filtreler **zorunlu** (WHERE), semantic skor **sıralama** katkısı:
  `rank = 0.6 × yakınlık_normalize + 0.4 × semantic_benzerlik` (ağırlıklar config: `AI_RANK_*`). Semantic terim yoksa saf yakınlık/skor sıralaması.

## 4. Cache Stratejisi

| Katman | Anahtar | TTL |
|---|---|---|
| Filtre çıkarımı | normalize edilmiş sorgu (lowercase, trim, TR karakter fold) | 7 gün — aynı sorgu tekrar LLM'e gitmez |
| Sorgu embedding | normalize semantic_terms | 30 gün |
| Popüler sorgular | ilk 100 sorgu ısıtılmış | kalıcı, haftalık yenile |

Cache Redis'te (yoksa Postgres `unlogged` tablo ile başla — [infrastructure.md](infrastructure.md) kararına bağlı). Hedef: cache hit oranı > %60 → LLM çağrı hacmi düşük kalır.

## 5. Fallback Davranışı (sessiz)

```
Haiku timeout (> 3 sn) / hata / boş çıkarım
        │
        ▼
Postgres FTS + pg_trgm keyword arama (isim, kategori, semt, editorial_note)
        │
        ▼
Sonuç normal listede döner; kullanıcı hata GÖRMEZ.
Yanıtta interpreted_filters: null → istemci "filtreye çevrilemedi" durumunu bilir ama UI sessiz kalır.
```

- Fallback oranı metriklenir (`ai_fallback_rate`); > %20 olursa prompt/model gözden geçirilir.
- AI tamamen kapatılabilir (`AI_SEARCH_ENABLED=false`) → `/search` doğrudan keyword moduna düşer (FR-AI-03 garantisi).

## 6. Yemekle İlgisiz / Kötüye Kullanım Sorguları

- Tool çıkarımı tüm alanları boş dönerse → keyword fallback; LLM'den serbest metin yanıtı asla kullanıcıya dönmez (yalnızca tool çıktısı işlenir).
- Sorgu uzunluğu limiti: 200 karakter (maliyet + injection yüzeyi).
