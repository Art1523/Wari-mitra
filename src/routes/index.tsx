import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Languages, MicVocal, PhoneCall, Users } from "lucide-react";
import { HonestyNote, PrototypeBadge } from "@/components/PrototypeBadge";
import { Button } from "@/components/ui/button";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import { DEMO_STEPS } from "@/services/demoService";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WariMitra AI — One Call. Every Warkari." },
      {
        name: "description",
        content:
          "Voice-first assistance for a safer, smarter and more accessible Pandharpur Wari. Prototype with demo data.",
      },
      { property: "og:title", content: "WariMitra AI — One Call. Every Warkari." },
      {
        property: "og:description",
        content:
          "Voice-first Wari assistance prototype: facilities, missing Warkari alerts and volunteer command centre.",
      },
    ],
  }),
  component: Landing,
});

const STATS = [
  { icon: Users, value: "10L+", label: "potential Warkaris", sub: "Estimated Wari participation" },
  {
    icon: MicVocal,
    value: "Voice-first",
    label: "no app needed",
    sub: "Designed for feature phones",
  },
  {
    icon: Languages,
    value: "Marathi-first",
    label: "मराठी-प्रथम",
    sub: "Understands Hindi & English too",
  },
];

const STEPS = [
  {
    title: "Call",
    marathi: "कॉल करा",
    detail: "A Warkari places a call — no smartphone or app required.",
  },
  {
    title: "Speak",
    marathi: "बोला",
    detail: "They speak naturally in Marathi — Hindi and English are understood too.",
  },
  {
    title: "Get Help",
    marathi: "मदत मिळवा",
    detail: "WariMitra answers with the nearest verified facility.",
  },
];

function Landing() {
  return (
    <div>
      <section className="relative overflow-hidden bg-navy-grad text-navy-foreground">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_15%_20%,var(--gold),transparent_45%),radial-gradient(circle_at_85%_70%,var(--saffron),transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rise-in">
              <PrototypeBadge className="border-gold/50 bg-gold/20 text-navy-foreground" />
              <h1 className="mt-5 text-5xl leading-[1.05] font-extrabold sm:text-6xl">
                WariMitra <span className="text-gradient-saffron">AI</span>
              </h1>
              <p className="mt-3 text-2xl font-semibold text-gold">“One Call. Every Warkari.”</p>
              <p className="mt-4 max-w-xl text-lg text-navy-foreground/80">
                Voice-first assistance for safer, smarter and more accessible Pandharpur Wari.
              </p>
              <p className="mt-2 max-w-xl text-base text-navy-foreground/70">
                वारकऱ्यांसाठी आवाजाद्वारे मदत — वैद्यकीय, पाणी, शौचालय, अन्नदान आणि हरवलेल्या
                वारकऱ्यांची सूचना.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-7 text-base">
                  <Link to="/voice">
                    <PhoneCall className="size-5" /> Try Voice Assistant
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-navy-foreground/40 bg-transparent px-7 text-base text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <Link to="/command">
                    View Command Centre <ArrowRight className="size-5" />
                  </Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {STATS.map((s) => (
                  <div
                    key={s.value}
                    className="rounded-2xl border border-navy-foreground/15 bg-navy-foreground/5 p-4"
                  >
                    <s.icon className="size-5 text-gold" />
                    <p className="mt-2 text-2xl font-bold">{s.value}</p>
                    <p className="text-sm text-navy-foreground/80">{s.label}</p>
                    <p className="mt-1 text-[11px] text-navy-foreground/55">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rise-in rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 backdrop-blur">
              <p className="text-xs font-bold tracking-widest text-gold uppercase">
                Simulated call preview
              </p>
              <div className="mt-4 space-y-3">
                <Bubble side="user" text="माझ्या जवळ मेडिकल कुठे आहे?" />
                <Bubble side="ai" text="तुम्ही सध्या कोणत्या गावाजवळ आहात?" />
                <Bubble side="user" text="मी जेजुरीजवळ आहे." />
                <Bubble side="ai" text="तुमच्या जवळ अंदाजे 450 मीटरवर वैद्यकीय मदत केंद्र आहे." />
              </div>
              <div className="mt-5 rounded-2xl bg-background p-4 text-foreground">
                <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
                  Nearest help
                </p>
                <p className="mt-1 text-lg font-bold text-navy">Primary Medical Camp</p>
                <p className="text-sm text-muted-foreground">Jejuri · 450 m · Open</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-navy">Call → Speak → Get Help</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Three steps. No app, no typing, no literacy barrier.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="surface-panel p-6">
              <span className="grid size-10 place-items-center rounded-full bg-saffron text-saffron-foreground font-bold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl font-bold text-navy">
                {s.title}{" "}
                <span className="text-base font-medium text-muted-foreground">· {s.marathi}</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-bold text-navy">How the system works</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Two flows power the prototype: an assistance flow and a community-powered missing-person
            flow.
          </p>
          <ArchitectureFlow className="mt-8" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-navy">3-minute guided demo</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Turn on Demo Mode in the header to reload demonstration data, then follow these nine
              steps.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/voice">Start at step 1</Link>
          </Button>
        </div>

        <ol className="mt-8 grid gap-3 md:grid-cols-3">
          {DEMO_STEPS.map((s) => (
            <li key={s.n} className="surface-panel p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-navy-foreground">
                  {s.n}
                </span>
                <h3 className="text-base font-bold text-navy">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.detail}</p>
              <Link
                to={s.to}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-saffron-deep hover:underline"
              >
                Open screen <ArrowRight className="size-4" />
              </Link>
            </li>
          ))}
        </ol>

        <div className="surface-panel mt-10 border-gold/50 bg-gold/10 p-6">
          <h3 className="text-lg font-bold text-navy">What this prototype is — and is not</h3>
          <HonestyNote className="mt-2 text-sm" />
          <ul className="mt-3 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
            <li>• Calls are simulated in the browser, not on a telephone network.</li>
            <li>• Locations come from spoken landmarks, not feature-phone GPS.</li>
            <li>• Facility, alert and analytics data is demo data stored locally.</li>
            <li>• Emergency actions are simulated; no real dispatch takes place.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function Bubble({ side, text }: { side: "user" | "ai"; text: string }) {
  const isUser = side === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <p
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-saffron px-4 py-2.5 text-sm text-saffron-foreground"
            : "max-w-[85%] rounded-2xl rounded-bl-sm bg-navy-foreground/12 px-4 py-2.5 text-sm text-navy-foreground"
        }
      >
        {text}
      </p>
    </div>
  );
}
