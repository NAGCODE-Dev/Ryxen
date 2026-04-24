import React from 'react';

function cx(...tokens) {
  return tokens.filter(Boolean).join(' ');
}

export function AppFrame({ children, reducedMotion = false, nativeShell = false }) {
  return (
    <div
      className="rx-shell"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-native-shell={nativeShell ? 'true' : 'false'}
    >
      <div className="rx-shellGlow rx-shellGlow-a" aria-hidden="true" />
      <div className="rx-shellGlow rx-shellGlow-b" aria-hidden="true" />
      <div className="rx-shellGrid" aria-hidden="true" />
      <div className="rx-shellInner">{children}</div>
    </div>
  );
}

export function TopBar({ title, subtitle = '', eyebrow = 'Ryxen Athlete', actions = null }) {
  return (
    <header className="rx-topbar">
      <div className="rx-topbarCopy">
        <div className="rx-eyebrow">{eyebrow}</div>
        <h1 className="rx-title">{title}</h1>
        {subtitle ? <p className="rx-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="rx-topbarActions">{actions}</div> : null}
    </header>
  );
}

export function BottomNav({ items = [] }) {
  return (
    <nav className="rx-bottomNav" aria-label="Navegação do atleta">
      {items.map((item) => {
        const Element = item.href ? 'a' : 'button';
        const props = item.href
          ? { href: item.href }
          : { type: 'button', onClick: item.onClick };
        return (
          <Element
            key={item.key}
            className={cx('rx-navItem', item.active && 'is-active', item.disabled && 'is-disabled')}
            aria-current={item.active ? 'page' : undefined}
            aria-disabled={item.disabled ? 'true' : undefined}
            {...props}
          >
            <span className="rx-navLabel">{item.label}</span>
            {item.caption ? <span className="rx-navCaption">{item.caption}</span> : null}
          </Element>
        );
      })}
    </nav>
  );
}

export function Hero({ eyebrow, title, subtitle, badges = [], actions = null, aside = null }) {
  return (
    <section className="rx-hero">
      <div className="rx-heroCopy">
        {eyebrow ? <div className="rx-eyebrow">{eyebrow}</div> : null}
        <h2 className="rx-heroTitle">{title}</h2>
        {subtitle ? <p className="rx-heroSubtitle">{subtitle}</p> : null}
        {badges.length ? (
          <div className="rx-pillRow">
            {badges.map((badge) => (
              <Pill key={`${badge.label}-${badge.tone || 'default'}`} tone={badge.tone}>
                {badge.label}
              </Pill>
            ))}
          </div>
        ) : null}
        {actions ? <div className="rx-actionRow">{actions}</div> : null}
      </div>
      {aside ? <div className="rx-heroAside">{aside}</div> : null}
    </section>
  );
}

export function MetricStrip({ metrics = [] }) {
  return (
    <section className="rx-metricStrip" aria-label="Resumo do dia">
      {metrics.map((metric) => (
        <article key={metric.label} className="rx-metricCard">
          <span className="rx-metricLabel">{metric.label}</span>
          <strong className="rx-metricValue">{metric.value}</strong>
          {metric.detail ? <span className="rx-metricDetail">{metric.detail}</span> : null}
        </article>
      ))}
    </section>
  );
}

export function ChipRail({ label, items = [], onSelect }) {
  return (
    <section className="rx-railSection">
      {label ? <div className="rx-sectionLead">{label}</div> : null}
      <div className="rx-chipRail" role="tablist" aria-label={label || 'Seleção'}>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx('rx-chip', item.active && 'is-active')}
            aria-pressed={item.active ? 'true' : 'false'}
            onClick={() => onSelect?.(item)}
          >
            <span className="rx-chipLabel">{item.label}</span>
            {item.meta ? <span className="rx-chipMeta">{item.meta}</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SectionCard({ eyebrow, title, subtitle, children, tone = 'default', actions = null }) {
  return (
    <section className={cx('rx-card', tone !== 'default' && `rx-card-${tone}`)}>
      {(eyebrow || title || subtitle || actions) ? (
        <header className="rx-cardHeader">
          <div>
            {eyebrow ? <div className="rx-sectionLead">{eyebrow}</div> : null}
            {title ? <h3 className="rx-cardTitle">{title}</h3> : null}
            {subtitle ? <p className="rx-cardSubtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="rx-cardActions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="rx-cardBody">{children}</div>
    </section>
  );
}

export function WorkoutCard({ block, index = 0 }) {
  const lines = Array.isArray(block?.lines) ? block.lines.filter(Boolean) : [];
  const parsedItems = Array.isArray(block?.parsed?.items) ? block.parsed.items : [];
  const goal = block?.parsed?.goal || '';
  const interval = Number(block?.parsed?.timeCapMinutes) > 0
    ? `${block.parsed.timeCapMinutes} min`
    : '';
  const period = block?.period || '';
  const type = String(block?.type || 'BLOCO').trim();

  return (
    <article className="rx-workoutCard">
      <div className="rx-workoutHeader">
        <div>
          <span className="rx-workoutIndex">{String(index + 1).padStart(2, '0')}</span>
          <h4 className="rx-workoutTitle">{block?.title || type}</h4>
        </div>
        <div className="rx-pillRow rx-pillRow-compact">
          <Pill tone="blue">{type}</Pill>
          {period ? <Pill tone="ember">{period}</Pill> : null}
          {interval ? <Pill>{interval}</Pill> : null}
        </div>
      </div>
      {lines.length ? (
        <ul className="rx-workoutLines">
          {lines.slice(0, 8).map((line, lineIndex) => (
            <li key={`${type}-${lineIndex}`}>{typeof line === 'string' ? line : line?.raw || line?.text || ''}</li>
          ))}
        </ul>
      ) : null}
      {!lines.length && parsedItems.length ? (
        <ul className="rx-workoutLines">
          {parsedItems.slice(0, 6).map((item, itemIndex) => (
            <li key={`${type}-item-${itemIndex}`}>{item.displayName || item.text || item.name || item.raw || ''}</li>
          ))}
        </ul>
      ) : null}
      {goal ? <div className="rx-workoutGoal">Objetivo: {goal}</div> : null}
    </article>
  );
}

export function PrimaryAction({ children, className = '', ...props }) {
  return (
    <button type="button" className={cx('rx-btn', 'rx-btn-primary', className)} {...props}>
      {children}
    </button>
  );
}

export function SecondaryAction({ children, className = '', ...props }) {
  return (
    <button type="button" className={cx('rx-btn', 'rx-btn-secondary', className)} {...props}>
      {children}
    </button>
  );
}

export function EmptyState({ title, copy, actions = null }) {
  return (
    <section className="rx-emptyState">
      <div className="rx-emptyOrb" aria-hidden="true" />
      <h3 className="rx-emptyTitle">{title}</h3>
      <p className="rx-emptyCopy">{copy}</p>
      {actions ? <div className="rx-actionRow">{actions}</div> : null}
    </section>
  );
}

export function SheetModal({ open, title, subtitle, children, footer = null, onClose }) {
  if (!open) return null;

  return (
    <div className="rx-modalRoot" role="presentation">
      <div className="rx-modalBackdrop" onClick={onClose} />
      <section className="rx-modalSheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="rx-modalHeader">
          <div>
            <h3 className="rx-cardTitle">{title}</h3>
            {subtitle ? <p className="rx-cardSubtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="rx-closeBtn" onClick={onClose} aria-label="Fechar revisão">
            ×
          </button>
        </header>
        <div className="rx-modalBody">{children}</div>
        {footer ? <footer className="rx-modalFooter">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Pill({ children, tone = 'default' }) {
  return <span className={cx('rx-pill', tone !== 'default' && `rx-pill-${tone}`)}>{children}</span>;
}
