const NAV_ITEMS = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'pricing', label: 'Planos', href: '/pricing.html' },
  { key: 'support', label: 'Suporte', href: '/support.html' },
  { key: 'privacy', label: 'Privacidade', href: '/privacy.html' },
  { key: 'terms', label: 'Termos', href: '/terms.html' },
  { key: 'coach', label: 'Coach Portal', href: '/coach/' },
];

mountPublicShell();

function mountPublicShell() {
  const page = document.body.dataset.publicPage || '';
  const headerRoot = document.getElementById('public-shell-header');
  const footerRoot = document.getElementById('public-shell-footer');

  if (headerRoot) {
    headerRoot.className = 'public-shellHeader';
    headerRoot.innerHTML = `
      <div class="public-topbar">
        <a class="public-brand" href="/">CrossApp Platform</a>
        <nav class="public-nav" aria-label="Navegação pública">
          ${NAV_ITEMS.map((item) => `
            <a class="public-navLink ${page === item.key ? 'isActive' : ''}" href="${item.href}">
              ${item.label}
            </a>
          `).join('')}
        </nav>
      </div>
    `;
  }

  if (footerRoot) {
    footerRoot.className = 'public-shellFooter';
    footerRoot.innerHTML = `
      <div class="public-footerCard">
        <div class="public-footerTop">
          <strong>CrossApp</strong>
          <div class="public-footerLinks">
            <a href="/">Home</a>
            <a href="/pricing.html">Planos</a>
            <a href="/support.html">Suporte</a>
            <a href="/privacy.html">Privacidade</a>
            <a href="/terms.html">Termos</a>
          </div>
        </div>
        <p class="public-body">Plataforma modular para treino, atletas, Coach Portal e competições. O núcleo atual resolve operação e performance sem vender camada fictícia de ERP.</p>
      </div>
    `;
  }
}
