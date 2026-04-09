#!/usr/bin/env bash
set -euo pipefail

resolve_launcher() {
  if command -v flatpak >/dev/null 2>&1 && flatpak info com.google.AndroidStudio >/dev/null 2>&1; then
    echo "flatpak:com.google.AndroidStudio"
    return 0
  fi

  local candidates=(
    "$HOME/android-studio/bin/studio.sh"
    "/opt/android-studio/bin/studio.sh"
    "/usr/local/android-studio/bin/studio.sh"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  if command -v studio.sh >/dev/null 2>&1; then
    command -v studio.sh
    return 0
  fi

  if command -v android-studio >/dev/null 2>&1; then
    command -v android-studio
    return 0
  fi

  if command -v studio >/dev/null 2>&1; then
    command -v studio
    return 0
  fi

  return 1
}

launcher=""
if launcher="$(resolve_launcher)"; then
  :
else
  cat >&2 <<'EOF'
[android-open] Android Studio launcher não encontrado.
Tente uma destas opções:
- instalar via Flatpak: flatpak install flathub com.google.AndroidStudio
- instalar em ~/android-studio ou /opt/android-studio
- expor `studio.sh`, `studio` ou `android-studio` no PATH
Depois valide com:
  npm run android:doctor
EOF
  exit 1
fi

if [[ "${1:-}" == "--print-path" ]]; then
  echo "$launcher"
  exit 0
fi

if [[ "$launcher" == flatpak:* ]]; then
  exec flatpak run "${launcher#flatpak:}" "$@"
fi

exec "$launcher" "$@"
