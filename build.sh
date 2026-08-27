#!/usr/bin/env bash
# Monta as 3 versoes do slideshow a partir de src/.
# Rode no Git Bash:  bash build.sh
set -euo pipefail
cd "$(dirname "$0")"

# Uma virgula fora do lugar em src/ so apareceria como tela preta no navegador.
# Melhor descobrir aqui.
if command -v node >/dev/null 2>&1; then
  for j in src/*.js; do
    node --check "$j" || { echo "ERRO de sintaxe em $j - nada foi gerado"; exit 1; }
  done
  echo "sintaxe ok"
fi

cabeca() {  # $1 = titulo
  printf '%s\n' \
    '<!doctype html>' \
    '<html lang="pt-BR">' \
    '<head>' \
    '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width, initial-scale=1">' \
    '<meta name="robots" content="noindex">' \
    "<title>$1</title>" \
    '<style>'
  cat src/estilo.css
  printf '%s\n' '</style>' '</head>' '<body>'
  cat src/corpo.html
}

rodape() {
  printf '%s\n' '</body>' '</html>'
}

# ---------------------------------------------- web (GitHub Pages / Netlify)
{
  cabeca "Slideshow"
  echo '<script src="config.js"></script>'
  echo '<script>'; cat src/trilha.js;   echo '</script>'
  echo '<script>'; cat src/midia.js;    echo '</script>'
  echo '<script>'; cat src/fonte-web.js; echo '</script>'
  echo '<script>'; cat src/motor.js;    echo '</script>'
  rodape
} > web/index.html

# ------------------------------------------------------------------ offline
{
  cabeca "Slideshow (offline)"
  echo '<script src="config.js"></script>'
  echo '<script src="lista.js"></script>'
  echo '<script>'; cat src/trilha.js;        echo '</script>'
  echo '<script>'; cat src/fonte-offline.js; echo '</script>'
  echo '<script>'; cat src/motor.js;         echo '</script>'
  rodape
} > offline/index.html

# --------------------------------------------------------------- apps script
{
  cabeca "Slideshow"
  echo '<script>'; cat src/config-appsscript.js; echo '</script>'
  echo '<script>'; cat src/trilha.js;            echo '</script>'
  echo '<script>'; cat src/midia.js;             echo '</script>'
  echo '<script>'; cat src/fonte-appsscript.js;  echo '</script>'
  echo '<script>'; cat src/motor.js;             echo '</script>'
  rodape
} > apps-script/index.html

echo "gerado:"

for f in web/index.html offline/index.html apps-script/index.html; do
  printf '  %-26s %s bytes\n' "$f" "$(wc -c < "$f" | tr -d ' ')"
done
