let currentAppBridge = null;

export function setAppBridge(api) {
  currentAppBridge = api || null;
  return currentAppBridge;
}

export function getAppBridge() {
  return currentAppBridge;
}

export function hasAppBridge() {
  return !!currentAppBridge;
}
