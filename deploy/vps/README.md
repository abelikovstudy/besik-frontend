# Besik SSR на VPS

Публичный origin текущего магазина: `https://api.167.233.175.222.sslip.io`.
Эта версия использует Node SSR: Caddy направляет `/api` и Swagger в backend,
а страницы, sitemap, robots и assets — в сервис `storefront:5174`.
Прежний SPA fallback `try_files ... /index.html` больше не используется.

## Подготовка релиза в Windows

```powershell
npm run release:vps
```

Сборка не обращается к API. `artifacts/besik-frontend.zip` содержит:

- `dist/client/` и `dist/server/`;
- `server/index.mjs`;
- `package.json`, `package-lock.json` и `Dockerfile`.

В архиве нет `.env`, SMTP/OAuth-ключей или node_modules. Рядом создаются
`Caddyfile.frontend` и `compose.vps.frontend.yml`. Сравните Compose с фактическим
файлом VPS перед применением, чтобы сохранить изменения backend.

## Настройки SSR

В production обязательно задайте `SITE_URL` — публичный HTTPS origin без пути,
например `https://shop.example.com`. Он определяет canonical, hreflang, sitemap
и абсолютные адреса фотографий. Для текущего VPS Compose имеет default с
существующим доменом; при смене домена обновите SITE_URL и адрес сайта в Caddyfile.

`SERVER_API_URL=http://api:3000/api` — внутренний адрес API в Docker.
`VITE_API_URL=/api` задаётся при сборке, браузер обращается к API на том же origin.
`HOST=0.0.0.0`, `PORT=5174` используются только внутри контейнера; порт SSR наружу
не публикуется. Публичные запросы SSR не содержат пользовательских cookie.

## Обновление на VPS

Передайте ZIP и подготовленные конфигурации на сервер своим обычным способом.
Из каталога backend, где находятся существующие Compose и `.env`:

```bash
BESIK_RELEASE_ID=$(date +%Y%m%d-%H%M%S)
BESIK_BACKUP_DIR="frontend/backups/$BESIK_RELEASE_ID"
mkdir -p "$BESIK_BACKUP_DIR" "frontend/releases/$BESIK_RELEASE_ID"
cp compose.vps.yml Caddyfile "$BESIK_BACKUP_DIR/"
if [ -L frontend/current ]; then readlink frontend/current > "$BESIK_BACKUP_DIR/previous-release"; fi
unzip /root/besik-frontend.zip -d "frontend/releases/$BESIK_RELEASE_ID"

ln -s "releases/$BESIK_RELEASE_ID" frontend/current.next
mv -Tf frontend/current.next frontend/current
docker compose -f compose.vps.frontend.yml config -q
docker compose -f compose.vps.frontend.yml build storefront
```

Продолжайте только при успешной проверке и сборке образа. Проверьте новый
Caddyfile через `caddy validate` до его применения. Затем:

```bash
cp compose.vps.frontend.yml compose.vps.yml
cp Caddyfile.frontend Caddyfile
docker compose -f compose.vps.yml up -d --no-deps storefront
docker compose -f compose.vps.yml up -d --no-deps --force-recreate caddy
docker compose -f compose.vps.yml ps
```

API, PostgreSQL и именованные volumes не пересоздаются. `down` и `down -v`
не нужны. Короткий перерыв при пересоздании Caddy возможен.

## Проверка после публикации

```bash
curl -I https://api.167.233.175.222.sslip.io/
curl -fsS https://api.167.233.175.222.sslip.io/robots.txt
curl -fsS https://api.167.233.175.222.sslip.io/sitemap.xml
curl -I https://api.167.233.175.222.sslip.io/products/not-found/999999999
docker compose -f compose.vps.yml logs --tail=50 storefront caddy
```

Ожидается 200 для каталога, sitemap и существующего товара, 404 для неизвестного
товара/пути и отсутствующих assets. Если backend недоступен, страницы и sitemap
возвращают 503. По любому URL из sitemap в исходном ответе curl должны быть h1,
описание, характеристики, canonical и JSON-LD — без выполнения JavaScript.
Swagger и `/api/auth/options` продолжают работать. Проверьте вход, корзину,
избранное и язык в браузере; создание реального заказа требует отдельного
согласованного сценария. Отправьте sitemap в Google Search Console.

## Возврат прежней версии

Сохраните путь `$BESIK_BACKUP_DIR`. Восстановите Compose и Caddyfile из него,
верните `frontend/current` на записанный `previous-release` через новую ссылку
и `mv -Tf`. Если прежняя версия была SSR, заново соберите `storefront` из её
release-каталога и перезапустите этот сервис. Для возврата старой статической
SPA достаточно прежнего Caddy/Compose; не удаляйте releases и образы до проверки.

Локальная проверка production-сборки: `npm run build`, затем `npm run preview`.
Она доступна на `http://127.0.0.1:4173`; `SITE_URL` и `SERVER_API_URL` можно задать
через окружение процесса. Docker/SSH-развёртывание не выполняется автоматически.
