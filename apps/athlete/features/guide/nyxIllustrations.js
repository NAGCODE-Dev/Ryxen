const NYX_POSES = {
  welcome: {
    src: '/branding/exports/nyx-base.png',
    width: 1536,
    height: 1024,
  },
  present: {
    src: '/branding/exports/nyx-mentor.png',
    width: 1024,
    height: 1536,
  },
  rest: {
    src: '/branding/exports/nyx-base.png',
    width: 1536,
    height: 1024,
  },
};

export function renderNyxIllustration({ pose = 'welcome', className = 'nyx-illustration' } = {}) {
  const asset = NYX_POSES[pose] || NYX_POSES.welcome;
  return `
    <img
      class="${className}"
      src="${asset.src}"
      alt="Nyx"
      width="${asset.width}"
      height="${asset.height}"
      loading="lazy"
      decoding="async"
    />
  `;
}
