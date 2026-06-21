import { useState, useEffect, useRef } from "react";
import { Mail, Github, ExternalLink, Download, MapPin, Twitter, ChevronDown } from "lucide-react";

const SECTIONS = ["about", "research", "publications", "cv", "contact"];

const C = {
  coral:  "#FF7B6B",
  yellow: "#FFD966",
  pink:   "#FFB3D1",
  lilac:  "#C9B8FF",
};

const publications = [
  {
    id: "01",
    title: "Efficient Long-Context Reasoning via Sparse Attention Distillation",
    venue: "NeurIPS 2024",
    color: C.coral,
    authors: "Jiwon Park, Seungmin Lee, Hyunwoo Kim, Minjoon Seo",
    year: "2024",
    tags: ["LLM", "Attention", "Efficiency"],
    abstract:
      "We propose SparseDistil, a training-efficient method for compressing long-context reasoning in large language models by distilling sparse attention patterns from teacher models.",
    links: { paper: "#", code: "#", slides: "#" },
  },
  {
    id: "02",
    title: "Cross-Lingual Knowledge Editing in Multilingual Language Models",
    venue: "ACL 2024",
    color: C.yellow,
    authors: "Jiwon Park, Yoonah Jang, Minjoon Seo",
    year: "2024",
    tags: ["Knowledge Editing", "Multilingual", "NLP"],
    abstract:
      "An investigation into how knowledge edits propagate across languages in multilingual LLMs, revealing asymmetric transfer patterns tied to language resource levels.",
    links: { paper: "#", code: "#" },
  },
  {
    id: "03",
    title: "Calibrating Uncertainty in Chain-of-Thought Reasoning",
    venue: "EMNLP 2023",
    color: C.pink,
    authors: "Jiwon Park, Seungmin Lee, Minjoon Seo",
    year: "2023",
    tags: ["Reasoning", "Calibration", "Chain-of-Thought"],
    abstract:
      "We identify systematic overconfidence in multi-step chain-of-thought reasoning and propose a lightweight post-hoc calibration method that improves reliability without retraining.",
    links: { paper: "#" },
  },
  {
    id: "04",
    title: "Korean Commonsense Reasoning Benchmark with Cultural Context",
    venue: "LREC-COLING 2024",
    color: C.lilac,
    authors: "Yoonah Jang, Jiwon Park, Soyeon Caren Han, Minjoon Seo",
    year: "2024",
    tags: ["Benchmark", "Korean NLP", "Commonsense"],
    abstract:
      "KorCSR, a culturally-grounded Korean commonsense reasoning dataset of 12,000 questions spanning social norms, historical context, and everyday reasoning.",
    links: { paper: "#", data: "#" },
  },
];

const researchAreas = [
  {
    num: "01",
    color: C.coral,
    title: "Reasoning & Planning in LLMs",
    desc: "Studying how large language models acquire and generalize multi-step reasoning — chain-of-thought, program synthesis, and symbolic integration.",
  },
  {
    num: "02",
    color: C.yellow,
    title: "Knowledge Representation & Editing",
    desc: "Investigating how factual knowledge is stored in transformer weights and how targeted edits can update model beliefs without catastrophic forgetting.",
  },
  {
    num: "03",
    color: C.pink,
    title: "Multilingual & Low-Resource NLP",
    desc: "Building language-inclusive AI systems that work equitably across Korean, East Asian languages, and lower-resource settings beyond English-dominant corpora.",
  },
  {
    num: "04",
    color: C.lilac,
    title: "Model Calibration & Reliability",
    desc: "Developing methods to make model confidence estimates trustworthy and measuring epistemic uncertainty in deployed language models.",
  },
];

const cvItems = {
  education: [
    {
      period: "2022 — Present",
      title: "Ph.D. in Artificial Intelligence",
      org: "KAIST",
      loc: "Daejeon, South Korea",
      note: "Advisor: Prof. Minjoon Seo · AI Graduate School",
    },
    {
      period: "2018 — 2022",
      title: "B.S. in Computer Science",
      org: "Seoul National University",
      loc: "Seoul, South Korea",
      note: "Summa Cum Laude · GPA 4.22 / 4.5",
    },
  ],
  experience: [
    {
      period: "Jun–Aug 2024",
      title: "Research Intern",
      org: "Google DeepMind",
      loc: "London, UK",
      note: "Language & Multimodal Reasoning team",
    },
    {
      period: "Jun–Aug 2023",
      title: "Research Intern",
      org: "NAVER AI Lab",
      loc: "Seongnam, South Korea",
      note: "HyperCLOVA language model team",
    },
  ],
  awards: [
    { year: "2024", title: "Outstanding Paper Award", org: "ACL 2024", color: C.coral },
    { year: "2023", title: "KAIST AI Graduate Fellowship", org: "KAIST", color: C.yellow },
    { year: "2022", title: "NRF National Science Fellowship", org: "Korea NRF", color: C.pink },
    { year: "2022", title: "Valedictorian", org: "Seoul National University, Dept. of CS", color: C.lilac },
  ],
};

export default function App() {
  const [activeSection, setActiveSection] = useState("about");
  const [expandedPub, setExpandedPub] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((id) => {
      const el = sectionRefs.current[id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-30% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (id: string) =>
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const navColors = [C.coral, C.yellow, C.pink, C.lilac, C.coral];

  return (
    <div
      className="min-h-screen bg-white text-foreground"
      style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
    >
      <div className="max-w-[1180px] mx-auto px-6 lg:px-12 flex flex-col lg:flex-row">

        {/* ── Sidebar ── */}
        <aside className="lg:w-64 lg:min-w-[256px] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto py-16 lg:py-20 lg:pr-10 flex flex-col justify-between">
          <div>
            {/* Avatar */}
            <div className="mb-8">
              <div
                className="w-20 h-20 rounded-full mb-4 overflow-hidden"
                style={{ outline: `3px solid ${C.pink}`, outlineOffset: "3px" }}
              >
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&auto=format"
                  alt="Jiwon Park"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1
                className="text-[1.6rem] leading-tight"
                style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: "#2A2A35" }}
              >
                Jiwon Park
              </h1>
              <p
                className="text-sm mt-0.5 mb-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: C.coral,
                }}
              >
                박지원
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ph.D. Candidate in AI
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <MapPin size={11} strokeWidth={1.5} />
                <span>KAIST · Daejeon, Korea</span>
              </div>
            </div>

            {/* Nav */}
            <nav className="space-y-0.5">
              {SECTIONS.map((id, i) => {
                const color = navColors[i];
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className="w-full text-left flex items-center gap-3 py-2 text-xs uppercase tracking-widest transition-colors duration-150"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isActive ? color : "#9090A8",
                    }}
                  >
                    <span
                      className="transition-all duration-200 rounded-full"
                      style={{
                        width: isActive ? 10 : 5,
                        height: isActive ? 10 : 5,
                        backgroundColor: isActive ? color : "#D0D0DC",
                        flexShrink: 0,
                      }}
                    />
                    {id}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Social */}
          <div className="flex gap-2 pb-6">
            {[
              { icon: Mail, c: C.coral, label: "Email", href: "mailto:jiwon@kaist.ac.kr" },
              { icon: Github, c: C.yellow, label: "GitHub", href: "#" },
              { icon: Twitter, c: C.pink, label: "Twitter", href: "#" },
              { icon: ExternalLink, c: C.lilac, label: "Scholar", href: "#" },
            ].map(({ icon: Icon, c, label, href }) => (
              <a
                key={label}
                href={href}
                title={label}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-110"
                style={{ backgroundColor: `${c}22`, border: `1.5px solid ${c}`, color: c }}
              >
                <Icon size={13} strokeWidth={2} />
              </a>
            ))}
          </div>
        </aside>

        {/* Divider */}
        <div
          className="hidden lg:block w-px self-stretch my-20"
          style={{
            background: `linear-gradient(to bottom, transparent, ${C.pink}60 20%, ${C.yellow}60 50%, ${C.coral}60 80%, transparent)`,
          }}
        />

        {/* ── Main ── */}
        <main className="flex-1 lg:pl-12 py-20 space-y-28">

          {/* About */}
          <section ref={(el) => { sectionRefs.current["about"] = el; }} id="about">
            <SectionLabel num="00" title="About" color={C.coral} />
            <div className="mt-6 max-w-[600px] space-y-4 text-[1.05rem] leading-[1.85] text-foreground/80">
              <p>
                I am a Ph.D. candidate at the{" "}
                <a href="#" style={{ color: C.coral, textDecoration: "none", borderBottom: `1.5px solid ${C.coral}55` }}>
                  KAIST AI Graduate School
                </a>
                , advised by{" "}
                <a href="#" style={{ color: C.coral, textDecoration: "none", borderBottom: `1.5px solid ${C.coral}55` }}>
                  Prof. Minjoon Seo
                </a>
                . My research sits at the intersection of NLP and machine learning — focused on making language models more reliable, interpretable, and equitable.
              </p>
              <p>
                I am particularly interested in how large language models reason, store knowledge, and generalize — and in building tools that expose and correct their failure modes. My work spans multilingual systems, model calibration, and knowledge editing.
              </p>
              <p>
                Before KAIST, I completed my B.S. in Computer Science at Seoul National University. I have interned at Google DeepMind (2024) and NAVER AI Lab (2023).
              </p>
            </div>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                { label: "Publications", value: "8", color: C.coral },
                { label: "Citations", value: "142", color: C.yellow },
                { label: "h-index", value: "4", color: C.pink },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="px-5 py-4 rounded-2xl"
                  style={{ backgroundColor: `${color}18`, border: `1.5px solid ${color}55` }}
                >
                  <div
                    className="text-3xl leading-none"
                    style={{ fontFamily: "'DM Serif Display', serif", color }}
                  >
                    {value}
                  </div>
                  <div
                    className="text-xs mt-1.5 tracking-wider uppercase"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: `${color}BB` }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Research */}
          <section ref={(el) => { sectionRefs.current["research"] = el; }} id="research">
            <SectionLabel num="01" title="Research Interests" color={C.yellow} />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {researchAreas.map((area) => (
                <div
                  key={area.num}
                  className="p-5 rounded-2xl transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: `${area.color}10`,
                    border: `1.5px solid ${area.color}45`,
                  }}
                >
                  <div
                    className="text-xs mb-2.5 tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace", color: area.color }}
                  >
                    {area.num}
                  </div>
                  <h3
                    className="text-[1rem] mb-2 leading-snug"
                    style={{ fontFamily: "'DM Serif Display', serif", color: "#2A2A35" }}
                  >
                    {area.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{area.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Publications */}
          <section ref={(el) => { sectionRefs.current["publications"] = el; }} id="publications">
            <SectionLabel num="02" title="Publications" color={C.pink} />
            <div className="mt-6 space-y-2.5">
              {publications.map((pub) => {
                const open = expandedPub === pub.id;
                return (
                  <div
                    key={pub.id}
                    className="rounded-2xl cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: open ? `${pub.color}12` : "#FAFAFA",
                      border: `1.5px solid ${open ? pub.color + "60" : "rgba(42,42,53,0.08)"}`,
                    }}
                    onClick={() => setExpandedPub(open ? null : pub.id)}
                  >
                    <div className="p-5 flex items-start gap-4">
                      {/* Color pill */}
                      <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: pub.color, minHeight: "2rem" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span
                            className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${pub.color}20`,
                              color: pub.color,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {pub.venue}
                          </span>
                          <span
                            className="text-xs"
                            style={{ fontFamily: "'JetBrains Mono', monospace", color: "#9090A8" }}
                          >
                            {pub.year}
                          </span>
                        </div>
                        <h3
                          className="text-[1rem] leading-snug mb-1"
                          style={{ fontFamily: "'DM Serif Display', serif", color: "#2A2A35" }}
                        >
                          {pub.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{pub.authors}</p>

                        {open && (
                          <div
                            className="mt-4 space-y-3 pt-4"
                            style={{ borderTop: `1px solid ${pub.color}30` }}
                          >
                            <p className="text-sm leading-relaxed text-foreground/75">{pub.abstract}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {pub.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: `${pub.color}18`,
                                    color: pub.color,
                                    fontFamily: "'JetBrains Mono', monospace",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-4 pt-0.5">
                              {Object.entries(pub.links).map(([type, href]) => (
                                <a
                                  key={type}
                                  href={href}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                                  style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: pub.color,
                                    textDecoration: "none",
                                  }}
                                >
                                  <ExternalLink size={10} />
                                  {type}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <ChevronDown
                        size={14}
                        strokeWidth={2}
                        className="shrink-0 mt-1.5 transition-transform duration-200"
                        style={{
                          color: pub.color,
                          transform: open ? "rotate(180deg)" : "none",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CV */}
          <section ref={(el) => { sectionRefs.current["cv"] = el; }} id="cv">
            <div className="flex items-start justify-between mb-6">
              <SectionLabel num="03" title="Curriculum Vitae" color={C.lilac} />
              <a
                href="#"
                className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-full transition-opacity hover:opacity-75"
                style={{
                  border: `1.5px solid ${C.lilac}`,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: C.lilac,
                  textDecoration: "none",
                  backgroundColor: `${C.lilac}12`,
                }}
              >
                <Download size={11} />
                Download PDF
              </a>
            </div>

            <div className="space-y-8">
              <CVBlock title="Education" items={cvItems.education} color={C.coral} />
              <CVBlock title="Research Experience" items={cvItems.experience} color={C.yellow} />

              <div>
                <h4
                  className="text-xs tracking-widest uppercase mb-3"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: "#9090A8" }}
                >
                  Awards & Fellowships
                </h4>
                <div className="space-y-2">
                  {cvItems.awards.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 p-4 rounded-2xl"
                      style={{
                        backgroundColor: `${item.color}10`,
                        border: `1.5px solid ${item.color}35`,
                      }}
                    >
                      <span
                        className="text-xs shrink-0 w-10 pt-0.5"
                        style={{ fontFamily: "'JetBrains Mono', monospace", color: item.color }}
                      >
                        {item.year}
                      </span>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "#2A2A35" }}>{item.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.org}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section ref={(el) => { sectionRefs.current["contact"] = el; }} id="contact" className="pb-20">
            <SectionLabel num="04" title="Contact" color={C.coral} />
            <div className="mt-6 max-w-[460px]">
              <p className="text-[1.05rem] leading-[1.85] text-foreground/75 mb-7">
                I am always happy to discuss research, potential collaborations, or just connect. The best way to reach me is by email.
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "Email", value: "jiwon@kaist.ac.kr", href: "mailto:jiwon@kaist.ac.kr", icon: Mail, c: C.coral },
                  { label: "GitHub", value: "github.com/jiwonpark", href: "#", icon: Github, c: C.yellow },
                  { label: "Twitter", value: "@jiwon_ai", href: "#", icon: Twitter, c: C.pink },
                  { label: "Scholar", value: "Google Scholar", href: "#", icon: ExternalLink, c: C.lilac },
                ].map(({ label, value, href, icon: Icon, c }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex items-center gap-4 py-3.5 px-4 rounded-2xl transition-transform duration-150 hover:-translate-y-0.5 group"
                    style={{
                      backgroundColor: `${c}10`,
                      border: `1.5px solid ${c}40`,
                      textDecoration: "none",
                    }}
                  >
                    <Icon size={14} strokeWidth={2} style={{ color: c }} className="shrink-0" />
                    <span
                      className="text-xs w-14 shrink-0"
                      style={{ fontFamily: "'JetBrains Mono', monospace", color: c }}
                    >
                      {label}
                    </span>
                    <span className="text-sm text-foreground/70 group-hover:text-foreground transition-colors">
                      {value}
                    </span>
                  </a>
                ))}
              </div>

              <p
                className="text-xs text-muted-foreground mt-10"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Last updated · June 2025 · Seoul, Korea
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionLabel({ num, title, color }: { num: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs tracking-widest"
        style={{ fontFamily: "'JetBrains Mono', monospace", color }}
      >
        {num}
      </span>
      <h2
        className="text-xl"
        style={{ fontFamily: "'DM Serif Display', serif", color: "#2A2A35" }}
      >
        {title}
      </h2>
      <div
        className="flex-1 h-px ml-1"
        style={{ background: `linear-gradient(to right, ${color}60, transparent)` }}
      />
    </div>
  );
}

function CVBlock({
  title,
  items,
  color,
}: {
  title: string;
  items: { period: string; title: string; org: string; loc: string; note: string }[];
  color: string;
}) {
  return (
    <div>
      <h4
        className="text-xs tracking-widest uppercase mb-3"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: "#9090A8" }}
      >
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-5 p-4 rounded-2xl"
            style={{
              backgroundColor: "#FAFAFA",
              border: `1.5px solid rgba(42,42,53,0.07)`,
              borderLeft: `3px solid ${color}`,
            }}
          >
            <span
              className="text-xs text-muted-foreground shrink-0 w-28 pt-0.5"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {item.period}
            </span>
            <div className="flex-1">
              <div
                className="text-[1rem] leading-snug"
                style={{ fontFamily: "'DM Serif Display', serif", color: "#2A2A35" }}
              >
                {item.title}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-sm text-foreground/80">{item.org}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{item.loc}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
