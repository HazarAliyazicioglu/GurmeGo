// Dev/local seed script — populates 1 City (İstanbul), 3 Districts (Kadıköy/Beşiktaş/Beyoğlu),
// and a handful of sample venues per district.
//
// Venue rows are created via `VenuesRepository.createWithLocation()` (apps/api/src/venues/venues.repository.ts)
// rather than a hand-rolled INSERT here, so the seed script can never drift from the authoritative
// column list / `location` (PostGIS geography) construction pattern established by ADR 002. The
// repository only needs a `PrismaService` instance in its constructor, and `PrismaService` takes no
// external constructor args (it builds its own DATABASE_URL-based driver adapter internally and adds
// NestJS lifecycle hooks around `PrismaClient`), so it's instantiated directly here without spinning
// up a Nest application context.
import { PrismaService } from "../src/prisma/prisma.service";
import { VenuesRepository } from "../src/venues/venues.repository";

const prisma = new PrismaService();
const venuesRepository = new VenuesRepository(prisma);

interface SeedDistrict {
  name: string;
  slug: string;
  venues: Array<{
    name: string;
    slug: string;
    category: string;
    cuisineType?: string;
    priceRange: "BUDGET" | "MODERATE" | "EXPENSIVE" | "PREMIUM";
    signatureItems: string[];
    editorialNote: string;
    lat: number;
    lng: number;
  }>;
}

const districtSeeds: SeedDistrict[] = [
  {
    name: "Kadıköy",
    slug: "kadikoy",
    venues: [
      {
        name: "Kadıköy Kahvecisi",
        slug: "kadikoy-kahvecisi",
        category: "cafe",
        cuisineType: "coffee",
        priceRange: "MODERATE",
        signatureItems: ["filtre kahve", "cheesecake"],
        editorialNote: "Örnek kürasyon notu — sahil hattına yakın butik kahveci.",
        lat: 40.99,
        lng: 29.02,
      },
      {
        name: "Moda Meyhanesi",
        slug: "moda-meyhanesi",
        category: "restaurant",
        cuisineType: "meyhane",
        priceRange: "EXPENSIVE",
        signatureItems: ["balık çeşitleri", "meze tabağı"],
        editorialNote: "Örnek kürasyon notu — Moda sahilinde aile işletmesi meyhane.",
        lat: 40.981,
        lng: 29.028,
      },
    ],
  },
  {
    name: "Beşiktaş",
    slug: "besiktas",
    venues: [
      {
        name: "Beşiktaş Kahvecisi",
        slug: "besiktas-kahvecisi",
        category: "cafe",
        cuisineType: "coffee",
        priceRange: "MODERATE",
        signatureItems: ["filtre kahve"],
        editorialNote: "Örnek kürasyon notu — iskele meydanına yürüme mesafesinde.",
        lat: 41.043,
        lng: 29.007,
      },
      {
        name: "Ortaköy Kumpircisi",
        slug: "ortakoy-kumpircisi",
        category: "street-food",
        cuisineType: "kumpir",
        priceRange: "BUDGET",
        signatureItems: ["kumpir", "waffle"],
        editorialNote: "Örnek kürasyon notu — Ortaköy meydanında uzun soluklu esnaf.",
        lat: 41.047,
        lng: 29.027,
      },
    ],
  },
  {
    name: "Beyoğlu",
    slug: "beyoglu",
    venues: [
      {
        name: "Beyoğlu Kahvecisi",
        slug: "beyoglu-kahvecisi",
        category: "cafe",
        cuisineType: "coffee",
        priceRange: "MODERATE",
        signatureItems: ["filtre kahve", "brownie"],
        editorialNote: "Örnek kürasyon notu — İstiklal Caddesi'ne paralel sokakta.",
        lat: 41.033,
        lng: 28.977,
      },
      {
        name: "Karaköy Fırın",
        slug: "karakoy-firin",
        category: "bakery",
        cuisineType: "pastane",
        priceRange: "MODERATE",
        signatureItems: ["poğaça", "profiterol"],
        editorialNote: "Örnek kürasyon notu — Karaköy'de sabah kuyruğu oluşan fırın.",
        lat: 41.025,
        lng: 28.977,
      },
    ],
  },
];

async function main() {
  const city = await prisma.city.upsert({
    where: { slug: "istanbul" },
    update: {},
    create: { name: "İstanbul", slug: "istanbul" },
  });

  for (const d of districtSeeds) {
    const district = await prisma.district.upsert({
      where: { slug: d.slug },
      update: {},
      create: { name: d.name, slug: d.slug, cityId: city.id },
    });

    for (const v of d.venues) {
      const existing = await prisma.venue.findUnique({ where: { slug: v.slug } });
      if (existing) continue;

      await venuesRepository.createWithLocation(prisma, {
        name: v.name,
        slug: v.slug,
        districtId: district.id,
        category: v.category,
        cuisineType: v.cuisineType,
        priceRange: v.priceRange,
        signatureItems: v.signatureItems,
        openingHours: { mon_fri: "09:00-22:00", sat_sun: "10:00-23:00" },
        editorialNote: v.editorialNote,
        isBoutique: true,
        branchCount: 1,
        franchiseFlag: false,
        source: "MANUAL",
        verifiedAt: new Date(),
        status: "PUBLISHED",
        lat: v.lat,
        lng: v.lng,
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
