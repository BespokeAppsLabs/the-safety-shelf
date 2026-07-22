import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/convex/_generated/api";

const LANDING_BENEFITS = [
  { icon: "🛡️", title: "Protection first", body: "Every screen and every title leads with practical safety value, not hype." },
  { icon: "👶", title: "Family aware", body: "Pregnancy and child safety are first-class shelves, not buried side topics." },
  { icon: "📚", title: "Digital and usable", body: "Buy once, read anywhere, and keep the guidance in your personal library." },
];

export async function LandingScreen() {
  const [categories, books] = await Promise.all([
    fetchQuery(api.categories.list),
    fetchQuery(api.books.listLive),
  ]);
  const topCategories = categories.slice(0, 4);
  const featured = books.slice(0, 3);
  const categoryTitleById = new Map(categories.map((category) => [category._id, category.title]));

  return (
    <div className="pb-20">
      <section className="border-b border-border bg-hero-gradient py-20 sm:py-28">
        <Container className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">The Safety Shelf</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
              Knowledge that protects lives.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted">
              Practical digital guides for pregnancy, child safety, first aid, home readiness, and everyday prevention.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/store" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong">
                Browse safety guides
              </Link>
              <Link href="/admin" className="rounded-full border border-border bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:bg-background">
                View admin dashboard
              </Link>
            </div>
          </div>
          <Card className="grid gap-4 bg-white/90">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Trusted shelves</p>
            {LANDING_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="rounded-3xl bg-background px-4 py-4">
                <p className="text-lg">{benefit.icon}</p>
                <p className="mt-3 font-semibold text-ink">{benefit.title}</p>
                <p className="mt-1 text-sm text-muted">{benefit.body}</p>
              </div>
            ))}
          </Card>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeader
            eyebrow="Core shelves"
            title="Built for real family and community safety needs."
            body="Start with the categories people actually search for when something matters."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {topCategories.map((category) => (
              <Card key={category._id} className="p-5">
                <p className="text-2xl">{category.icon}</p>
                <h3 className="mt-4 text-xl font-semibold text-ink">{category.title}</h3>
                <p className="mt-2 text-sm text-muted">{category.description}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeader
            eyebrow="Featured guides"
            title="Start with the most practical titles."
            body="Preview the first set of digital guides already seeded into the storefront demo."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((book) => (
              <Card key={book.slug} className="flex flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">{categoryTitleById.get(book.categoryId)}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-ink">{book.title}</h3>
                  <p className="mt-2 text-sm text-muted">{book.blurb}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{book.author}</span>
                  <Link href={`/book/${book.slug}`} className="text-sm font-semibold text-primary">
                    Open guide →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
