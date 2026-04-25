import Image from "next/image";

import athleteShot from "../../../../../branding/exports/ryxen-athlete-product-shot.png";
import coachShot from "../../../../../branding/exports/ryxen-coach-portal-shot.png";
import wordmark from "../../../../../branding/exports/ryxen-logo-white.png";

const proofItems = [
  "Landing, pricing e legais sem runtime operacional.",
  "Wordmark oficial aplicada no rebuild.",
  "Product shots reais do atleta e do coach.",
];

export default function MarketingHomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Public Surface Rebuild</div>
          <div className="brandLockup">
            <Image
              className="hub-wordmark"
              src={wordmark}
              alt="Ryxen"
              priority
              sizes="(max-width: 900px) 72vw, 460px"
            />
          </div>

          <h1>O rebuild abre com a marca certa e o produto real.</h1>
          <p className="lead">
            A nova landing da Ryxen agora usa a wordmark oficial e mostra as
            duas frentes principais da plataforma logo na hero: experiência do
            atleta e Coach Portal, sem depender de logo desenhada com CSS.
          </p>

          <div className="actions">
            <a className="button buttonPrimary" href="/pricing">
              Ver pricing
            </a>
            <a className="button buttonSecondary" href="/coach">
              Abrir coach portal
            </a>
          </div>

          <div className="proofRow">
            {proofItems.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="visualStack">
          <article className="shotCard shotCardCoach">
            <div className="tag">Coach Portal</div>
            <h2>Operação, acompanhamento e contexto em uma visão editorial.</h2>
            <p>
              A página agora aponta para o produto de verdade, com captura
              oficial do portal do coach.
            </p>
            <div className="shotFrame">
              <Image
                src={coachShot}
                alt="Coach Portal do Ryxen em uma visão editorial de dashboard"
                priority
                sizes="(max-width: 900px) 100vw, 560px"
              />
            </div>
          </article>

          <article className="shotCard">
            <div className="tag">Athlete App</div>
            <h2>Treino do dia, progresso e leitura clara para o atleta.</h2>
            <p>
              O rebuild já começa vendendo a experiência central do produto em
              vez de uma abstração genérica.
            </p>
            <div className="shotFrame">
              <Image
                src={athleteShot}
                alt="Aplicativo do atleta da Ryxen com treino do dia e progresso"
                sizes="(max-width: 900px) 100vw, 520px"
              />
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead">
          <div>
            <div className="eyebrow">Estado Atual</div>
            <h2>Base pronta para seguir a migração pública.</h2>
          </div>
          <p>
            A home do rebuild sai do placeholder e vira uma entrada coerente
            para expandir hub, pricing e páginas legais no App Router.
          </p>
        </div>

        <div className="grid3">
          <article className="card">
            <div className="tag">Branding</div>
            <h3>Wordmark oficial no topo</h3>
            <p>
              A landing não depende mais de lockup inventado. A identidade
              visual vem direto dos exports oficiais do repositório.
            </p>
          </article>

          <article className="card">
            <div className="tag">Produto</div>
            <h3>Hero focada em prova visual</h3>
            <p>
              Os dois product shots ajudam a explicar rápido o que a Ryxen
              entrega para coach e atleta.
            </p>
          </article>

          <article className="card">
            <div className="tag">Rebuild</div>
            <h3>Separação clara entre público e operacional</h3>
            <p>
              A superfície pública pode evoluir no Next sem carregar a
              complexidade do runtime autenticado.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
