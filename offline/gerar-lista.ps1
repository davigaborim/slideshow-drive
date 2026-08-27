# Le a pasta .\fotos e gera lista.js para o slideshow offline.
# Uso: clique com o botao direito > "Executar com o PowerShell"
#      ou, no terminal:  powershell -ExecutionPolicy Bypass -File .\gerar-lista.ps1

$raiz  = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir   = Join-Path $raiz 'fotos'
$saida = Join-Path $raiz 'lista.js'

if (-not (Test-Path $dir)) {
    Write-Host "Nao achei a pasta 'fotos'. Criando..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $dir | Out-Null
}

$ext = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif',
         '.mp4', '.m4v', '.mov', '.webm', '.ogv',
         '.mp3', '.m4a', '.aac', '.ogg', '.wav')

# -Recurse: o ZIP do Drive vem com as subpastas dentro, e elas contam
$arquivos = @(
    Get-ChildItem -Path $dir -File -Recurse |
        Where-Object { $ext -contains $_.Extension.ToLower() } |
        Sort-Object FullName
)

# caminho relativo a .\fotos, com barra normal, para virar URL no navegador
$prefixo = (Resolve-Path $dir).Path.TrimEnd('\') + '\'
function Caminho-Relativo($f) {
    return $f.FullName.Substring($prefixo.Length) -replace '\\', '/'
}

if ($arquivos.Count -eq 0) {
    Write-Host ""
    Write-Host "Nenhuma imagem em: $dir" -ForegroundColor Red
    Write-Host "Baixe a pasta do Drive (botao direito > Fazer download), extraia o ZIP" -ForegroundColor Red
    Write-Host "aqui dentro e rode este script de novo." -ForegroundColor Red
    Write-Host ""
    Read-Host "Enter para fechar" | Out-Null
    exit 1
}

$itens = @(
    $arquivos | ForEach-Object {
        '"' + ((Caminho-Relativo $_) -replace '\\', '\\\\' -replace '"', '\"') + '"'
    }
) -join ','

$conteudo = "/* gerado por gerar-lista.ps1 em $(Get-Date -Format 'dd/MM/yyyy HH:mm') */" +
            "`r`nwindow.FOTOS_LOCAIS = [$itens];`r`n"

# UTF-8 sem BOM, para o navegador nao engasgar em nomes acentuados
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($saida, $conteudo, $utf8)

Write-Host ""
Write-Host "OK - $($arquivos.Count) imagens catalogadas em lista.js" -ForegroundColor Green
Write-Host "Agora abra index.html no navegador e aperte F11." -ForegroundColor Green
Write-Host ""

# quantas em cada subpasta
$arquivos | Group-Object { $p = Split-Path (Caminho-Relativo $_) -Parent; if ($p) { $p } else { '(raiz)' } } |
    Sort-Object Name | ForEach-Object {
        Write-Host ("  {0,-40} {1} foto(s)" -f $_.Name, $_.Count) -ForegroundColor DarkGray
    }

$ia = @($arquivos | Where-Object { $_.Name -like 'IA_*' }).Count
Write-Host ""
Write-Host "  $ia de 5 com o prefixo IA_" -ForegroundColor DarkGray

Read-Host "Enter para fechar" | Out-Null
