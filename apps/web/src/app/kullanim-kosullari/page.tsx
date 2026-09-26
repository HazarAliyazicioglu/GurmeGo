import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Koşulları — GurmeGo",
  description: "GurmeGo'yu kullanırken geçerli olan koşullar.",
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Hizmet",
    body: [
      "GurmeGo, İstanbul'daki butik mekanları keşfetmene yardım eden bir rehberdir. Mekan bilgileri (menü, fiyat, çalışma saatleri) kürasyon ekibi tarafından derlenir ve zamanla değişebilir; gitmeden önce mekanla doğrulamanı öneririz.",
    ],
  },
  {
    title: "Hesabın",
    body: [
      "Hesabının güvenliğinden sen sorumlusun. Bir başkasının hesabını kullanmamalı, hizmeti kötüye kullanmamalı veya otomatik yöntemlerle toplu veri çekmemelisin.",
    ],
  },
  {
    title: "Katkıların",
    body: [
      "Gönderdiğin şikayet veya düzeltmeler inceleme kuyruğuna alınır; onaylanmadan yayınlanmaz. Yanıltıcı, hakaret içeren veya yasa dışı içerik göndermemelisin. Uygunsuz kullanımda hesabını kısıtlama hakkımız saklıdır.",
    ],
  },
  {
    title: "Sorumluluk sınırı",
    body: [
      "Bilgiler “olduğu gibi” sunulur; eksiksizlik veya güncellik garantisi verilmez. Mekanların kendi hizmetlerinden ve fiyatlarından GurmeGo sorumlu değildir.",
    ],
  },
  {
    title: "Değişiklikler",
    body: ["Bu koşullar güncellenebilir; güncel hâli bu sayfada yayınlanır. Hizmeti kullanmaya devam etmen, güncel koşulları kabul ettiğin anlamına gelir."],
  },
];

export default function KullanimKosullariPage() {
  return (
    <main className="mx-auto max-w-3xl pt-10 sm:pt-14">
      <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Kullanım Koşulları</h1>
      <p className="mt-3 text-sm font-medium text-ink/55">Son güncelleme: 26 Eylül 2026</p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-ink">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm font-medium leading-relaxed text-ink/70">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
