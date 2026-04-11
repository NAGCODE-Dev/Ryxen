export function createRenderScheduler({ performRender }) {
  let renderQueued = false;
  let renderInflight = null;
  let lastRenderAt = 0;
  let renderDirty = false;

  const rerender = () => {
    if (renderInflight) {
      renderDirty = true;
      return renderInflight;
    }

    renderInflight = new Promise((resolve, reject) => {
      const flush = () => {
        renderQueued = false;
        Promise.resolve()
          .then(() => performRender())
          .then(() => {
            lastRenderAt = Date.now();
            resolve();
          })
          .catch(reject)
          .finally(() => {
            renderInflight = null;
            if (renderDirty) {
              renderDirty = false;
              rerender();
            }
          });
      };

      if (renderQueued || Date.now() - lastRenderAt < 12) {
        renderQueued = true;
        window.requestAnimationFrame(flush);
        return;
      }

      flush();
    });

    return renderInflight;
  };

  return {
    rerender,
  };
}
