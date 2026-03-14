export function exposeAppApi(api) {
  window.__APP__ = {
    ...api,
  };
}
