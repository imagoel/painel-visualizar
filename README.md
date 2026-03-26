# Painel de 3 Sistemas

Projeto simples para alternar entre 3 sistemas em uma unica tela.

## Como usar

1. Abra `script.js`.
2. No bloco `const systems = [...]`, preencha `url` de cada sistema.
3. Se tiver logo dos outros sistemas, preencha `logo` com o caminho da imagem.
4. Abra `index.html` no navegador.

## Exemplo de configuracao

```js
{
  id: "c2",
  name: "C2",
  subtitle: "Sistema principal",
  url: "https://seu-link-aqui",
  logo: "assets/c2-logo.svg",
}
```

## Observacao importante

Alguns sistemas podem bloquear exibicao em `iframe`. Quando isso acontecer, use o botao **Abrir em nova aba**.
