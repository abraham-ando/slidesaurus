import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

const features = [
  {
    title: "Zero-Config Discovery",
    description:
      "Drop Markdown files into a slidev/ directory and the plugin automatically discovers and registers them as presentations. No manual configuration per file.",
  },
  {
    title: "Parallel Builds",
    description:
      "Presentations build in parallel during docusaurus build with configurable concurrency limits. Large slide decks never block each other.",
  },
  {
    title: "Theme & Addon Support",
    description:
      "Use any official or community Slidev theme. Override themes per-presentation via frontmatter. Missing packages are auto-installed.",
  },
  {
    title: "Category Organization",
    description:
      "Organize presentations into categories with subdirectories and _category_.yml files. The overview page renders them as grouped cards.",
  },
  {
    title: "Embeddable Previews",
    description:
      "Use the <SlidevLink> component in any MDX page to embed a responsive, scaled-down preview of any presentation with a click-through link.",
  },
  {
    title: "TypeScript-First",
    description:
      "Fully typed plugin options, frontmatter fields, and theme components. Comprehensive IntelliSense support in your Docusaurus config.",
  },
];

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get Started
          </Link>
          <Link
            className="button button--secondary button--outline button--lg"
            href="https://github.com/parmenides/slidesaurus"
          >
            View on GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center padding-horiz--md padding-vert--lg">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {features.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageCode() {
  return (
    <section className={styles.codeSection}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <h2>Minimal Configuration</h2>
            <p>
              Add the plugin to your Docusaurus config and start creating
              presentations immediately.
            </p>
          </div>
          <div className="col col--6">
            <pre className={styles.codeBlock}>
              <code>
                {`// docusaurus.config.ts
plugins: [
  [
    "slidesaurus",
    {
      path: "./slidev",
      routeBasePath: "/presentations",
      theme: "seriph",
    },
  ],
],`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageCode />
      </main>
    </Layout>
  );
}
