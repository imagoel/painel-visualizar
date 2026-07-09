# Painel Visualizar

Aplicacao web institucional para centralizar links, paineis, midias e comunicados por secretaria, com login, permissoes, administracao de acessos e captura/exportacao de telefones do hotspot.

## Visao geral

O sistema funciona como um hub operacional para secretarias:

- usuarios acessam apenas os sistemas e midias liberados para sua secretaria
- administradores gerenciam secretarias, usuarios, sistemas e permissoes
- itens podem ser cadastrados por link, imagem ou video
- a propria visualizacao permite adicionar e ajustar itens quando o usuario tem permissao
- telefones capturados pelo hotspot ficam disponiveis no admin com filtros e exportacao

## Tecnologias

- Node.js
- Express
- SQLite
- Sessao por cookie `httpOnly`
- `bcryptjs` para hash de senha
- `exceljs` para exportacao XLSX

## Funcionalidades implementadas

### Painel

- login institucional
- painel protegido por sessao
- visualizacao de sistemas por secretaria
- cadastro de item por URL ou midia
- link opcional quando o item e apenas banner/video/imagem
- upload de midia ate 100 MB
- exibicao automatica dos itens com tempo configuravel
- editor da visualizacao para adicionar, atualizar, remover midia e excluir itens

### Administracao

- cadastro e edicao de secretarias
- cadastro e edicao de usuarios
- gestao de sistemas/midias exibidos
- controle de permissoes por secretaria
- painel administrativo de telefones capturados
- filtro por data e origem do hotspot
- origem amigavel para capturas do CMS e da regulacao
- exportacao CSV e XLSX dos telefones

### Hotspot

- endpoint publico para captura de telefone, MAC, IP e origem
- normalizacao de telefone
- consolidacao de acessos repetidos por telefone
- data da primeira captura e da ultima visualizacao
- exportacao com filtros para rotina administrativa

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Inicie a aplicacao:

```bash
npm start
```

3. Acesse:

```text
http://localhost:3000
```

## Credenciais iniciais

- Admin
  - E-mail: `admin@amargosa.ba.gov.br`
  - Senha: `admin123`
- Secretaria SEAFI
  - E-mail: `seafi@amargosa.ba.gov.br`
  - Senha: `seafi123`

Recomendacao: altere as senhas iniciais apos subir o sistema em producao.

## Rotas principais

- `/login`: tela de autenticacao
- `/painel`: visualizacao dos sistemas liberados para o usuario
- `/admin`: area administrativa
- `/api/hotspot/telefones`: captura publica de telefones do hotspot
- `/api/admin/hotspot/telefones`: listagem administrativa dos telefones, com filtros `date` e `origem`
- `/api/admin/hotspot/telefones.csv`: exportacao CSV dos telefones capturados
- `/api/admin/hotspot/telefones.xlsx`: exportacao XLSX dos telefones capturados, com filtros opcionais `?date=YYYY-MM-DD&origem=...`

## Persistencia

O banco SQLite fica em `data/painel.db`.

No `docker-compose.yml`, o volume `painel_data` garante persistencia de usuarios, secretarias e sistemas mesmo apos redeploy.

## Captura de telefones do hotspot

O endpoint publico espera `POST` com `telefone`, `mac`, `ip` e `origem`.

Exemplo para liberar o painel antes da autenticacao no MikroTik:

```mikrotik
/ip hotspot walled-garden ip add action=accept protocol=tcp dst-address=10.75.2.4 dst-port=38520
```

Depois do login administrativo, os telefones aparecem em `/admin` e podem ser baixados em planilha XLSX. O filtro por dia usa a data da ultima visualizacao registrada no hotspot e pode ser combinado com o filtro de origem.

Origens reconhecidas atualmente:

- `hotspot-amargosa`
- `hotspot-regulacao`
- `hotspot-cms`

## Deploy e operacao

- O `docker-compose.yml` sobe a aplicacao com volume persistente para `data/`.
- O banco SQLite fica em `data/painel.db`.
- Uploads ficam em `data/uploads`.
- Em ambientes com Nginx ou proxy reverso, configure o limite de upload acima de 100 MB, por exemplo `client_max_body_size 150M`.

## Pontos de atencao

- Troque as credenciais iniciais antes de uso real.
- Configure um `SESSION_SECRET` forte em producao.
- Revise quais origens do hotspot serao aceitas publicamente antes de expor o endpoint.
- Evite publicar dados reais de telefones em prints, README, LinkedIn ou apresentacoes.
