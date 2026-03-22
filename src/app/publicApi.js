import { setAppBridge } from './bridge.js';

export function exposeAppApi(api) {
  return setAppBridge({
    ...api,
  });
}
