#!/bin/sh
set -eu
studio_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
studio_data_directory=${XDG_DATA_HOME:-"$HOME/.local/share"}
case "$studio_directory" in
  *'%'*|*'\'*|*'"'*|*'`'*|*'$'*)
    printf '%s\n' 'Move the app to a path without desktop-entry escape characters, then run this installer again.' >&2
    exit 1
    ;;
esac
case "$studio_directory" in
  *'
'*) printf '%s\n' 'The application path cannot contain a newline.' >&2; exit 1 ;;
esac
if [ ! -x "$studio_directory/launch-ultracart-studio" ] || [ ! -x "$studio_directory/ultracart-studio" ]; then
  printf '%s\n' 'Extract the complete Linux archive before installing its launcher.' >&2
  exit 1
fi
mkdir -p "$studio_data_directory/applications" "$studio_data_directory/icons/hicolor/512x512/apps"
cp "$studio_directory/ultracart-studio.png" "$studio_data_directory/icons/hicolor/512x512/apps/ultracart-studio.png"
cat > "$studio_data_directory/applications/ultracart-studio.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=UltraCart Studio
Comment=Build and review UltraCart storefronts
Exec="$studio_directory/launch-ultracart-studio"
Icon=ultracart-studio
Terminal=false
Categories=Development;Utility;
StartupWMClass=UltraCart Studio
EOF
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$studio_data_directory/applications"
fi
printf '%s\n' 'Installed the UltraCart Studio launcher for this user. Keep the extracted app at its current path.'
