import Image from "next/image";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { api } from "@/convex/_generated/api";
import { Price } from "@/components/store/Price";
import { fill } from "@/lib/i18n";
import { getServerI18n } from "@/lib/i18n.server";

const SHELF_IMAGES: Record<string, string> = {
  "pregnancy-safety": "/images/shelves/pregnancy-safety.webp",
  "child-safety": "/images/shelves/child-safety.webp",
  "first-aid": "/images/shelves/first-aid.webp",
  "emergency-preparedness": "/images/shelves/emergency-preparedness.webp",
};

export async function LandingScreen() {
  const [{ dict }, categories, books] = await Promise.all([
    getServerI18n(),
    fetchQuery(api.categories.list),
    fetchQuery(api.books.listLive),
  ]);
  const promises = dict.landing.promises;
  const topCategories = categories.slice(0, 4);
  const featured = books.slice(0, 3);
  const categoryTitleById = new Map(categories.map((category) => [category._id, category.title]));

  return (
    <main className="landing-page overflow-hidden bg-[#f4f0e7] text-[#10251f]">
      <a href="#main-content" className="landing-skip-link">
        {dict.nav.skipToContent}
      </a>

      <div className="bg-[#10251f] px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-[#f4f0e7] sm:text-xs">
        {dict.landing.bannerLeft} <span className="px-2 text-[#efaa35]">✦</span> {dict.landing.bannerRight}
      </div>

      <header className="relative z-30">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center gap-3" aria-label={dict.nav.homeAria}>
            <span className="grid size-11 place-items-center rounded-full border border-[#10251f]/15 bg-white">
              <Logo className="size-7" />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.2em]">{dict.brand.name}</span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-[#52665f]">
                {dict.brand.taglineShort}
              </span>
            </span>
          </Link>

          <nav aria-label={dict.nav.mainNavigation} className="hidden items-center gap-8 md:flex">
            <Link href="#shelves" className="landing-nav-link">{dict.nav.shelves}</Link>
            <Link href="#featured" className="landing-nav-link">{dict.nav.featured}</Link>
            <Link href="#mission" className="landing-nav-link">{dict.nav.purpose}</Link>
          </nav>

          <Link
            href="/store"
            className="group inline-flex items-center gap-3 rounded-full bg-[#10251f] px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#147a5c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10251f]"
          >
            {dict.landing.shopBooks}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">↗</span>
          </Link>
        </Container>
      </header>

      <section id="main-content" className="relative pb-16 pt-8 sm:pb-24 sm:pt-12">
        <div className="landing-orbit landing-orbit-one" />
        <div className="landing-orbit landing-orbit-two" />
        <Container className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div className="relative z-10">
            <p className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-[#147a5c]">
              <span className="h-px w-10 bg-[#147a5c]" />
              {dict.landing.heroKicker}
            </p>
            <h1 className="landing-display mt-7 max-w-[820px] text-[clamp(4rem,9vw,8.6rem)] leading-[0.79] tracking-[-0.075em]">
              {dict.landing.heroTitleLine1}
              <span className="block text-[#147a5c]">{dict.landing.heroTitleLine2}</span>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-[#52665f] sm:text-lg">
              {dict.landing.heroBody}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/store"
                className="group inline-flex items-center gap-5 rounded-full bg-[#efaa35] px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#10251f] transition hover:-translate-y-0.5 hover:bg-[#f6bd5e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10251f]"
              >
                {dict.landing.exploreCollection}
                <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#52665f]">
                {dict.landing.instantAccess}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[600px] lg:mr-0">
            <div className="landing-hero-frame relative ml-5 aspect-[4/5] overflow-hidden rounded-[2rem] bg-[#10251f] sm:ml-12 sm:rounded-[3rem]">
              <Image
                src="/images/safety-shelf-hero.png"
                alt={dict.landing.heroImageAlt}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 44vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10251f]/55 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white sm:bottom-8 sm:left-8 sm:right-8">
                <p className="max-w-[12rem] text-xs font-bold uppercase leading-5 tracking-[0.19em]">
                  {dict.landing.heroCaption}
                </p>
                <span className="grid size-12 place-items-center rounded-full border border-white/40 bg-white/10 text-xl backdrop-blur">↘</span>
              </div>
            </div>
            <div className="absolute -left-1 top-[14%] grid size-24 place-items-center rounded-full bg-[#efaa35] text-center text-[10px] font-black uppercase leading-4 tracking-[0.16em] shadow-[0_16px_40px_rgba(16,37,31,.25)] sm:size-32 sm:text-xs">
              <span>{dict.landing.heroBadge.split("\n").map((line, i) => (
                <span key={line} className="block">{line}</span>
              ))}</span>
            </div>
            <div className="absolute -bottom-6 -right-2 h-28 w-24 rounded-t-full bg-[#147a5c] sm:-right-8 sm:h-40 sm:w-32" aria-hidden="true" />
          </div>
        </Container>
      </section>

      <section aria-label={dict.landing.promisesLabel} className="border-y border-[#10251f]/15 bg-[#efaa35] py-4">
        <div className="flex min-w-max items-center justify-around gap-7 px-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#10251f] sm:gap-12 sm:text-xs">
          {[...promises, ...promises].map((promise, index) => (
            <span key={`${promise}-${index}`} className={index >= promises.length ? "hidden lg:inline" : ""}>
              {promise} <span className="ml-7 text-[#f4f0e7] sm:ml-12">✦</span>
            </span>
          ))}
        </div>
      </section>

      <section id="shelves" className="relative py-20 sm:py-28">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:gap-16">
            <div className="lg:sticky lg:top-10 lg:self-start">
              <p className="landing-kicker">{dict.landing.shelvesKicker}</p>
              <h2 className="landing-display mt-5 text-5xl leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                {dict.landing.shelvesTitle}
              </h2>
              <p className="mt-6 max-w-md leading-7 text-[#52665f]">
                {dict.landing.shelvesBody}
              </p>
              <Link href="/store" className="landing-text-link mt-8">
                {dict.landing.browseEveryShelf} <span aria-hidden="true">↗</span>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {topCategories.map((category, index) => (
                <Link
                  href={{ pathname: "/store", query: { category: category.slug } }}
                  key={category._id}
                  className={`landing-category group min-h-72 rounded-[2rem] bg-[#10251f] p-7 text-white sm:p-8 ${
                    index === 0 ? "sm:row-span-2 sm:min-h-[37rem]" : ""
                  }`}
                >
                  {SHELF_IMAGES[category.slug] ? (
                    <Image
                      src={SHELF_IMAGES[category.slug]}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 32vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#10251f] via-[#10251f]/45 to-black/10" />
                  <div className="relative z-10 flex justify-end">
                    <span className="grid size-11 place-items-center rounded-full border border-white/35 bg-black/10 transition group-hover:rotate-45">
                      ↗
                    </span>
                  </div>
                  <div className="relative z-10 mt-auto pt-16">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-65">
                      {dict.landing.shelfLabel} {String(index + 1).padStart(2, "0")}
                    </p>
                    <h3 className="landing-display mt-3 text-4xl leading-none tracking-[-0.04em]">{category.title}</h3>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
                      {category.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section id="featured" className="bg-[#10251f] py-20 text-white sm:py-28">
        <Container>
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <p className="landing-kicker text-[#efaa35]">{dict.landing.featuredKicker}</p>
              <h2 className="landing-display mt-5 max-w-3xl text-5xl leading-[0.88] tracking-[-0.055em] sm:text-7xl">
                {dict.landing.featuredTitle}
              </h2>
            </div>
            <Link href="/store" className="landing-text-link border-white/30 text-white">
              {dict.landing.seeFullCollection} <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {featured.map((book) => (
              <Link href={`/book/${book.slug}`} key={book._id} className="group">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#efaa35]">
                  {categoryTitleById.get(book.categoryId)}
                </p>
                <div className="relative aspect-[2/3] overflow-hidden rounded-3xl bg-[#29483e]">
                  {book.coverUrl ? (
                    // Convex storage URLs are runtime data, so keep this as a native image.
                    <img src={book.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
                  ) : (
                    <div
                      className="absolute inset-0 transition duration-700 group-hover:scale-[1.02]"
                      style={{ background: `linear-gradient(145deg, ${book.gradientFrom ?? "#147a5c"}, ${book.gradientTo ?? "#2f7dbd"})` }}
                    />
                  )}
                </div>
                <div className="py-5">
                  <h3 className="landing-display text-3xl leading-none tracking-[-0.035em] sm:text-4xl">{book.title}</h3>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.17em] text-white/65">{book.author}</p>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <p className="max-w-xs text-sm leading-6 text-white/60">{book.blurb}</p>
                    <Price
                      cents={book.priceCents}
                      className="shrink-0 rounded-full bg-[#efaa35] px-3 py-2 text-xs font-black text-[#10251f]"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section id="mission" className="relative overflow-hidden bg-[#dce9e2] py-20 sm:py-28">
        <div className="absolute -right-36 -top-36 size-[30rem] rounded-full border-[5rem] border-[#147a5c]/10" />
        <Container className="relative grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="landing-kicker">{dict.landing.missionKicker}</p>
            <blockquote className="landing-display mt-6 max-w-4xl text-5xl leading-[0.96] tracking-[-0.055em] sm:text-7xl">
              {dict.landing.missionQuote}
            </blockquote>
          </div>
          <div>
            <p className="max-w-lg text-base leading-7 text-[#52665f]">
              {dict.landing.missionBody}
            </p>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {dict.landing.trustMarks.map((mark) => (
                <div key={mark.label} className="border-t border-[#10251f]/25 pt-4">
                  <p className="landing-display text-3xl tracking-[-0.04em]">{mark.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#52665f]">{mark.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[#efaa35] py-20 sm:py-28">
        <Container className="text-center">
          <p className="landing-kicker">{dict.landing.ctaKicker}</p>
          <h2 className="landing-display mx-auto mt-6 max-w-5xl text-[clamp(3.5rem,8vw,8rem)] leading-[0.82] tracking-[-0.07em]">
            {dict.landing.ctaTitle}
          </h2>
          <Link
            href="/store"
            className="mt-10 inline-flex items-center gap-5 rounded-full bg-[#10251f] px-8 py-4 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:-translate-y-1 hover:bg-[#147a5c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10251f]"
          >
            {dict.landing.buildLibrary} <span aria-hidden="true">→</span>
          </Link>
        </Container>
      </section>

      <footer className="bg-[#10251f] py-10 text-white">
        <Container className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo className="size-10" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em]">{dict.brand.name}</p>
              <p className="mt-1 text-xs text-white/50">{dict.brand.strapline}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-[0.14em] text-white/60">
            <Link href="/store" className="hover:text-white">{dict.nav.store}</Link>
            <Link href="/library" className="hover:text-white">{dict.nav.library}</Link>
            <Link href="/admin" className="hover:text-white">{dict.nav.admin}</Link>
            <span>{fill(dict.footer.copyright, { year: new Date().getFullYear() })}</span>
          </div>
        </Container>
      </footer>
    </main>
  );
}
