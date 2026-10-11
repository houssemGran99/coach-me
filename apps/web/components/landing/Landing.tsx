import { IconArrow, IconBall, IconCheck, IconClock, IconGlobe, IconLink, IconPlay, IconShield, IconTimer, IconWifi } from "./Icons";
import { FAQ, STEPS, STRIP } from "./content";
import { PhoneDemo } from "./PhoneDemo";
import { Reveal } from "./Reveal";
import { WaitlistForm } from "./WaitlistForm";
import "./landing.css";

function Eyebrow({ children }: { children: string }) {
  return <div className="eyebrow">{children}</div>;
}

/**
 * Marketing page, always in French. It is drawn as a full-screen layer with its own scroll
 * so it does not inherit the app's header, footer or content width.
 */
export function Landing() {
  return (
    <div className="lp" lang="fr" dir="ltr" id="top">
      <noscript><style>{".lp .rv{opacity:1;transform:none}"}</style></noscript>

      <nav>
        <div className="wrap">
          <a className="logo" href="#top" aria-label="Coach"><i><IconBall /></i>Coach</a>
          <div className="links"><a href="#fonctions">Fonctions</a><a href="#comment">Comment ça marche</a><a href="#faq">FAQ</a></div>
          <div className="actions">
            <a className="signin" href="/login">Se connecter</a>
            <a className="btn gold sm" href="#acces">Accès anticipé</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="glow" style={{ width: 520, height: 520, background: "#1f7a43", top: -120, left: -160 }} />
        <div className="glow" style={{ width: 420, height: 420, background: "#b8860b", top: 120, right: -120, opacity: 0.28 }} />
        <div className="wrap">
          <div className="grid">
            <div>
              <Reveal><span className="pill"><b>Nouveau</b>Pour les entraîneurs d&apos;académies en Tunisie</span></Reveal>
              <Reveal><h1>Votre séance prête <em>en 30 secondes.</em></h1></Reveal>
              <Reveal>
                <p className="lead">
                  Décrivez votre effectif et ce qui n&apos;a pas marché la semaine dernière. Coach compose une séance chronométrée avec des exercices que vous <strong>voyez en animation</strong> avant de les installer sur le terrain.
                </p>
              </Reveal>
              <Reveal className="cta">
                <a className="btn gold" href="#acces">Rejoindre l&apos;accès anticipé <IconArrow /></a>
                <a className="btn line" href="#comment">Voir comment ça marche</a>
              </Reveal>
              <Reveal className="trust">
                {["Gratuit au lancement", "Fonctionne hors connexion", "Aucune donnée sur les joueurs"].map((t) => (
                  <span key={t}><IconCheck />{t}</span>
                ))}
              </Reveal>
            </div>

            <Reveal className="phone-wrap">
              <div className="chip c1"><div className="ic"><IconClock /></div><div><b>Séance de 60 min</b><small>5 exercices chronométrés</small></div></div>
              <div className="chip c2"><div className="ic"><IconLink /></div><div><b>Lien partagé</b><small>Ouvert sur WhatsApp</small></div></div>
              <PhoneDemo />
            </Reveal>
          </div>
        </div>
      </header>

      <section style={{ paddingTop: 0, paddingBottom: 40 }}>
        <div className="wrap">
          <Reveal className="strip">
            {STRIP.map((s) => (
              <div key={s.value}><b>{s.value}</b><span>{s.label}</span></div>
            ))}
          </Reveal>
        </div>
      </section>

      <section id="fonctions">
        <div className="wrap">
          <Reveal className="head">
            <Eyebrow>Fonctions</Eyebrow>
            <h2>Tout pour entraîner,<br />rien de superflu.</h2>
            <p className="sub">Une base solide que vous gardez la main pour modifier : l&apos;entraîneur décide, toujours.</p>
          </Reveal>
          <div className="bento">
            <Reveal className="card b-a">
              <div className="ic"><IconPlay /></div>
              <h3>Des exercices animés, pas des schémas à décoder</h3>
              <p>Voyez les déplacements, les passes et les zones avant la séance. Chaque étape est légendée pour que vos adjoints comprennent en dix secondes.</p>
            </Reveal>
            <Reveal className="card b-b" delay={70}>
              <div className="ic"><IconTimer /></div>
              <h3>Séance chronométrée</h3>
              <p>Échauffement, exercices, jeu, retour au calme, avec une durée par bloc.</p>
            </Reveal>
            <Reveal className="card b-c">
              <div className="ic"><IconLink /></div>
              <h3>Partage par lien</h3>
              <p>Envoyez un exercice par WhatsApp. Il s&apos;ouvre sur le téléphone, sans installation.</p>
            </Reveal>
            <Reveal className="card b-d" delay={70}>
              <div className="ic"><IconWifi /></div>
              <h3>Hors connexion</h3>
              <p>Vos séances restent accessibles au stade, même avec un mauvais réseau.</p>
            </Reveal>
            <Reveal className="card b-e" delay={140}>
              <div className="ic"><IconGlobe /></div>
              <h3>Français, arabe, anglais</h3>
              <p>Interface complète, y compris l&apos;arabe de droite à gauche. Écrivez comme vous parlez.</p>
              <div className="langs"><span>Français</span><span lang="ar">العربية</span><span>English</span></div>
            </Reveal>
            <Reveal className="card b-full">
              <div className="ic"><IconShield /></div>
              <h3>Contenu relu et contenu IA toujours séparés</h3>
              <p>
                Un exercice n&apos;est marqué « Relu » qu&apos;après validation par un entraîneur nommé. Tout ce qui est généré par IA porte la mention « Brouillon IA » jusqu&apos;à votre confirmation. Aucune donnée sur les joueurs n&apos;est collectée, et Coach refuse les demandes de santé ou de traitement concernant un enfant.
              </p>
              <div className="badges"><span className="badge ok">Relu par un entraîneur</span><span className="badge ai">Brouillon IA</span></div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="comment" className="tint">
        <div className="wrap">
          <Reveal className="head">
            <Eyebrow>Comment ça marche</Eyebrow>
            <h2>Trois étapes,<br />sur votre téléphone.</h2>
          </Reveal>
          <div className="steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} className="step" delay={i * 70}>
                <span className="n" aria-hidden="true">{`0${i + 1}`}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="acces">
        <div className="wrap">
          <Reveal className="final">
            <div className="glow" style={{ width: 380, height: 380, background: "#f2c230", top: -200, left: "50%", marginLeft: -190, opacity: 0.22 }} />
            <div className="inner">
              <Eyebrow>Accès anticipé</Eyebrow>
              <h2>Construisons-le<br />avec vous.</h2>
              <p>Nous ouvrons Coach à un petit groupe d&apos;entraîneurs et d&apos;académies. Laissez votre e-mail et nous vous contactons.</p>
              <WaitlistForm />
              <div className="fine">Gratuit pendant le lancement · Pas de spam</div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="faq">
        <div className="wrap">
          <Reveal className="head"><Eyebrow>FAQ</Eyebrow><h2>Questions fréquentes</h2></Reveal>
          <Reveal className="faq">
            {FAQ.map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="wrap"><a className="logo" href="#top"><i><IconBall /></i>Coach</a><span>© 2026 Coach · Fait pour les entraîneurs de Tunisie.</span></div>
      </footer>
    </div>
  );
}
