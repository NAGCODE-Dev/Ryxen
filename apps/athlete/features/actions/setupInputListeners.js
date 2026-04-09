import { syncTrustedDeviceAuthUi } from '../account/trustedDeviceUi.js';

export function registerAthleteInputListeners({ root, filterAthletePrs }) {
  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!target) return;

    if (target.id === 'ui-prsSearch') {
      filterAthletePrs(root, target.value);
      return;
    }

    if (target.id === 'auth-email') {
      syncTrustedDeviceAuthUi(root);
    }
  });
}
