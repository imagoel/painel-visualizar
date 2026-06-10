# Painel de Sistemas com Login

Aplicacao web com login institucional, painel protegido por usuario, permissoes por secretaria e administracao centralizada de acessos.

## Tecnologias

- Node.js
- Express
- SQLite
- Sessao por cookie `httpOnly`

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
- `/api/admin/hotspot/telefones.csv`: exportacao CSV dos telefones capturados
- `/api/admin/hotspot/telefones.xlsx`: exportacao XLSX dos telefones capturados, com filtro opcional `?date=YYYY-MM-DD`

## Persistencia

O banco SQLite fica em `data/painel.db`.

No `docker-compose.yml`, o volume `painel_data` garante persistencia de usuarios, secretarias e sistemas mesmo apos redeploy.

## Uploads e Nginx

O sistema aceita midias de ate 20 MB por item. Como o envio atual usa JSON com base64, o corpo HTTP fica maior que o arquivo original; por isso o Express aceita ate 50 MB por requisicao.

Se houver Nginx na frente do container, ajuste o site/proxy com:

```nginx
client_max_body_size 50M;
```

Depois valide e recarregue o Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Ha um exemplo completo em `deploy/nginx/visualizador.conf`.

## Captura de telefones do hotspot

O endpoint publico espera `POST` com `telefone`, `mac`, `ip` e `origem`.

Exemplo para liberar o painel antes da autenticacao no MikroTik:

```mikrotik
/ip hotspot walled-garden ip add action=accept protocol=tcp dst-address=10.75.2.4 dst-port=38520
```

Depois do login administrativo, os telefones aparecem em `/admin` e podem ser baixados em planilha XLSX. O filtro por dia usa a data da primeira captura do telefone para evitar duplicidade entre exportacoes diarias.
