# Modelo de Configuração Local

Crie manualmente um arquivo `.env` na raiz do projeto para execução local. Esse arquivo deve permanecer ignorado pelo Git. O modelo abaixo não contém credenciais e pode ser copiado para o ambiente local conforme a integração de autenticação e armazenamento escolhida.

```dotenv
DATABASE_URL=
JWT_SECRET=

VITE_APP_ID=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=

BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=

# Integração com o Bling (credenciais sempre no servidor)
BLING_CLIENT_ID=
BLING_CLIENT_SECRET=
BLING_REDIRECT_URI=https://seu-dominio.example/api/bling/oauth/callback
BLING_API_BASE_URL=https://api.bling.com.br/Api/v3
BLING_OAUTH_BASE_URL=https://www.bling.com.br/Api/v3/oauth
BLING_WEBHOOK_SECRET=

# Usada somente pelo script scripts/seed-catalog.mjs.
SEED_OWNER_ID=
```

No ambiente gerenciado, variáveis de banco, autenticação e armazenamento são configuradas pelo painel seguro do projeto. Não copie segredos para commits, documentação pública ou mensagens de erro.
