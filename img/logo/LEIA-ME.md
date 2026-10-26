# AdmPro – arquivos da logo

Copie a pasta inteira para `img/logo/` dentro do projeto.

## Pastas

| Pasta | Conteúdo | Quando usar |
|---|---|---|
| `svg/` | Logo em vetor, texto já convertido em curvas (não depende da fonte) | **Preferencial dentro do sistema**: header, tela de login, onboarding |
| `png/` | Mesmas versões em PNG transparente (600 e 1200 px de largura) | Documentos, PDF do orçamento, redes sociais, e-mail |
| `favicon/` | Favicons, ícones do app (PWA) e ícone do iPhone | Tags no `<head>` do `index.html` |

## Versões

- **logo-horizontal**: uso padrão sobre fundo claro.
- **logo-horizontal-negativo**: sobre o tema escuro (#0F1518).
- **logo-branca**: sobre fundo colorido (ex.: azul-petróleo #0E5A6B).
- **logo-monocromatica**: impressão em uma cor, carimbo, recibo.
- **logo-vertical**: tela de login e onboarding.
- **simbolo**: só o ícone, para espaços pequenos e avatar.

## No `<head>` do index.html

```html
<link rel="icon" href="img/logo/favicon/favicon.ico" sizes="any">
<link rel="icon" href="img/logo/favicon/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="img/logo/favicon/apple-touch-icon.png">
<link rel="manifest" href="img/logo/favicon/site.webmanifest">
<meta name="theme-color" content="#0E5A6B">
```

## No header do app (trocando conforme o tema)

```html
<picture>
  <source srcset="img/logo/svg/logo-horizontal-negativo.svg" media="(prefers-color-scheme: dark)">
  <img src="img/logo/svg/logo-horizontal.svg" alt="AdmPro" height="28">
</picture>
```

Se o tema for trocado manualmente pelo usuário (atributo `data-theme`), troque o `src` do `<img>` via JavaScript na mesma função que aplica o tema.

## Cores e fonte

- Primária `#0E5A6B` · Destaque `#8EE3CF` · Texto `#1A2328` · Primária no escuro `#5BC2D6`
- Fonte do nome: **Manrope** (Google Fonts) – "Adm" peso 500, "Pro" peso 800.

## Regras rápidas

- Não distorcer, girar nem trocar as cores fora das versões acima.
- Manter um espaço livre ao redor da logo de pelo menos metade da altura do símbolo.
- Tamanho mínimo: 24 px de altura no header; abaixo disso, use só o símbolo.
