import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — GurmeGo",
  description: "GurmeGo hangi verileri, neden ve nerede işler.",
};

const SECTIONS: Array<{ title: string; body: string[] }> = [
  {
    title: "Hangi verileri topluyoruz",
    body: [
      "Hesap oluşturduğunda e-posta adresini ve şifreni (şifre yalnızca şifrelenmiş olarak, kimlik doğrulama sağlayıcımızda tutulur) işleriz.",
      "Favori listelerini ve listelerine eklediğin mekanları hesabına bağlı olarak saklarız.",
      "Bir mekan hakkında gönderdiğin şikayet veya düzeltme metnini, incelenmesi için saklarız.",
    ],
  },
  {
    title: "Konum bilgin",
    body: [
      "“Yakınımda” gibi özellikleri kullanırsan tarayıcın izninle konumunu paylaşırsın. Konum yalnızca o anki sorguyu yanıtlamak için kullanılır; konum bilgin sunucularımızda saklanmaz, kaydedilmez ve analiz amacıyla hiçbir yere iletilmez.",
      "Konum iznini istediğin an tarayıcı ayarlarından geri alabilirsin; site konum olmadan da çalışır.",
    ],
  },
  {
    title: "Verilerin nerede işleniyor",
    body: [
      "Kimlik doğrulama ve veritabanı: Supabase. API sunucusu: Railway. Web sitesi barındırma: Vercel. Bu sağlayıcılar verini yalnızca hizmeti sunmak için işler.",
      "Harita karoları OpenStreetMap sunucularından yüklenir; bu sırada IP adresin OpenStreetMap tarafından görülür.",
      "Reklam veya üçüncü taraf takip/analitik araçları kullanmıyoruz.",
    ],
  },
  {
    title: "Tarayıcı depolaması",
    body: [
      "Oturumunu açık tutmak için tarayıcının yerel depolamasında bir oturum anahtarı saklanır. Çıkış yaptığında silinir. Bunun dışında çerez veya izleme amaçlı depolama kullanmıyoruz.",
    ],
  },
  {
    title: "Haklarını nasıl kullanırsın (KVKK)",
    body: [
      "6698 sayılı KVKK uyarınca verilerine erişme, düzeltme, silme ve işlenmesine itiraz etme hakkın vardır. Hesabının ve ona bağlı tüm verilerin silinmesini talep edebilirsin.",
      "Veri sorumlusu bilgileri ve başvuru kanalı, hizmet resmî olarak yayına alındığında bu sayfada güncellenecektir.",
    ],
  },
  {
    title: "Değişiklikler",
    body: ["Bu politika değişirse güncel hâli bu sayfada yayınlanır."],
  },
];

export default function GizlilikPage() {
  return (
    <main className="mx-auto max-w-3xl pt-10 sm:pt-14">
      <h1 className="font-serif text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Gizlilik Politikası</h1>
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
