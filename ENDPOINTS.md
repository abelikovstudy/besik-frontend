# Besik Backend — API для фронтенда

Документ описывает фактически доступные HTTP endpoint-ы текущей версии backend.

## Общие правила

- Base URL локально: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Формат запросов и ответов: `application/json`
- Авторизация пока не реализована.
- Все PostgreSQL `BIGINT` ID передаются строками: `"123"`.
- Все значения `NUMERIC`, включая цены и количества, передаются строками: `"12.50"`, `"3.000"`.
- Даты передаются в ISO 8601: `"2026-09-14T12:00:00.000Z"`.
- Поля `createdAt`, `updatedAt`, `receivedAt`, `paidAt` возвращаются как ISO-строки.
- Для частичного изменения используется `PATCH`: отправляйте только изменяемые поля.
- Успешный `DELETE` возвращает `204 No Content` без тела.

Формат локализованного текста:

```json
{
  "ka": "ქართული",
  "en": "English",
  "ru": "Русский"
}
```

Стандартная ошибка NestJS выглядит примерно так:

```json
{
  "statusCode": 400,
  "message": "Описание ошибки",
  "error": "Bad Request"
}
```

Основные коды: `400` — неверные данные или переход состояния, `404` — объект не найден, `409` — конфликт уникальности, `500` — внутренняя ошибка.

## Units

Endpoint-ы:

- `GET /units` — список единиц измерения.
- `GET /units/:id` — одна единица.
- `POST /units` — создать.
- `PATCH /units/:id` — изменить.
- `DELETE /units/:id` — удалить.

Тело создания:

```json
{
  "code": "kg",
  "nameI18n": { "ka": "კილოგრამი", "en": "Kilogram", "ru": "Килограмм" },
  "symbolI18n": { "ka": "კგ", "en": "kg", "ru": "кг" },
  "allowsFraction": true,
  "isActive": true
}
```

## Categories

Endpoint-ы:

- `GET /categories` — список категорий.
- `GET /categories/:id` — категория по ID.
- `GET /categories/:parentId/children` — непосредственные дочерние категории.
- `POST /categories` — создать категорию.
- `PATCH /categories/:id` — изменить категорию.
- `DELETE /categories/:id` — удалить категорию.

Тело создания:

```json
{
  "parentId": "1",
  "nameI18n": { "ka": "ტელევიზორები", "en": "TVs", "ru": "Телевизоры" },
  "slug": "tvs",
  "descriptionI18n": { "ka": "აღწერა", "en": "Description", "ru": "Описание" },
  "isActive": true
}
```

`parentId` необязателен. Backend запрещает отсутствующего родителя и циклы в дереве категорий.

## Products

Endpoint-ы:

- `GET /products` — список товаров.
- `GET /products/:id` — товар по bigint ID.
- `GET /products/slug/:slug` — товар по slug.
- `POST /products` — создать товар.
- `PATCH /products/:id` — изменить товар.
- `DELETE /products/:id` — удалить товар.

Тело создания:

```json
{
  "categoryId": "1",
  "nameI18n": { "ka": "ტელევიზორი", "en": "Television", "ru": "Телевизор" },
  "slug": "television",
  "brandName": "Demo Brand",
  "descriptionI18n": { "ka": "აღწერა", "en": "Description", "ru": "Описание" },
  "attributes": { "screenSize": 55, "resolution": "4K" },
  "status": "active"
}
```

Статусы товара: `draft`, `active`, `inactive`, `archived`.

## Product variants

Endpoint-ы:

- `GET /product-variants` — список вариантов, максимум 1000 записей.
- `GET /product-variants/active` — активные варианты.
- `GET /product-variants/:id` — вариант по ID.
- `GET /product-variants/product/:productId` — варианты товара.
- `GET /product-variants/sku/:sku` — вариант по SKU.
- `POST /product-variants` — создать вариант.
- `PATCH /product-variants/:id` — частично изменить вариант.
- `DELETE /product-variants/:id` — удалить вариант.

Тело создания:

```json
{
  "productId": "1",
  "unitId": "1",
  "sku": "TV-55-BLK",
  "barcode": "1234567890123",
  "nameI18n": { "ka": "55 შავი", "en": "55 Black", "ru": "55 Черный" },
  "attributes": { "color": "black" },
  "price": "1299.99",
  "currency": "GEL",
  "isActive": true
}
```

## Warehouses

Endpoint-ы:

- `GET /warehouses`
- `GET /warehouses/:id`
- `POST /warehouses`
- `PATCH /warehouses/:id`
- `DELETE /warehouses/:id`

Тело создания:

```json
{
  "code": "TBS-01",
  "name": "Tbilisi Warehouse",
  "address": "Tbilisi",
  "isActive": true
}
```

## Inventory

Endpoint-ы:

- `GET /inventory` — физические и зарезервированные остатки.
- `GET /inventory/available` — остатки с вычисленным `availableQty`.
- `GET /inventory/:id` — запись остатка по ID.
- `POST /inventory/receive` — принять товар.
- `POST /inventory/adjust` — установить фактический остаток.

Приём товара:

```json
{
  "warehouseId": "1",
  "variantId": "10",
  "quantity": "25.500",
  "reason": "Supplier delivery",
  "lot": {
    "lotNumber": "LOT-2026-001",
    "manufacturedAt": "2026-08-01",
    "expirationDate": "2027-08-01"
  }
}
```

`lot` и `reason` необязательны. Операция атомарно обновляет остаток, партию и историю движения.

Корректировка остатка:

```json
{
  "warehouseId": "1",
  "variantId": "10",
  "newPhysicalQty": "24.000",
  "reason": "Stocktaking"
}
```

`newPhysicalQty` — новое абсолютное значение, а не разница. Оно не может быть меньше зарезервированного количества.

Пример ответа inventory:

```json
{
  "id": "5",
  "warehouseId": "1",
  "variantId": "10",
  "physicalQty": "25.500",
  "reservedQty": "2.000",
  "updatedAt": "2026-09-14T12:00:00.000Z"
}
```

## Inventory lots

Только чтение:

- `GET /inventory-lots`
- `GET /inventory-lots/:id`

Партии создаются через `POST /inventory/receive`.

## Inventory movements

Только чтение:

- `GET /movements` — все движения.
- `GET /movements/:id` — движение по ID.
- `GET /movements/warehouse/:warehouseId` — движения склада.
- `GET /movements/variant/:variantId` — движения варианта.

Типы движения: `receive`, `sale`, `return`, `adjustment`, `transfer_out`, `transfer_in`, `damage`, `loss`, `expiration`.

## Customers

Endpoint-ы:

- `GET /customers`
- `GET /customers/:id`
- `POST /customers`
- `PATCH /customers/:id`
- `DELETE /customers/:id`

Тело создания:

```json
{
  "email": "user@example.com",
  "passwordHash": "already-hashed-password",
  "firstName": "Nino",
  "lastName": "Example",
  "phone": "+995555000000",
  "isActive": true
}
```

Важно: текущий API принимает уже вычисленный `passwordHash`. Поле `passwordHash` никогда не возвращается в ответах.

## Orders

Endpoint-ы:

- `GET /orders` — список заказов.
- `GET /orders/:id` — заказ без позиций.
- `GET /orders/:id/items` — позиции заказа.
- `POST /orders` — создать заказ.

Тело создания заказа с доставкой:

```json
{
  "customerId": "7",
  "items": [
    { "variantId": "10", "quantity": "2" },
    { "variantId": "11", "quantity": "1.500" }
  ],
  "deliveryMethod": "delivery",
  "deliveryAddress": {
    "city": "Tbilisi",
    "addressLine": "Rustaveli Ave 1",
    "apartment": "12",
    "postalCode": "0108",
    "recipientName": "Nino Example",
    "recipientPhone": "+995555000000"
  },
  "customerNote": "Call before delivery"
}
```

Для гостевого заказа `customerId` можно не передавать. Для `delivery` адрес обязателен. Для `pickup` поле `deliveryAddress` передавать нельзя.

Backend сам формирует `orderNumber`, цены, валюту и snapshot-поля. Все варианты заказа должны иметь одинаковую валюту. Цена доставки задаётся переменной backend `DELIVERY_FEE_GEL`, pickup всегда бесплатный.

Статусы заказа: `pending`, `awaiting_payment`, `paid`, `processing`, `shipped`, `completed`, `cancelled`, `payment_failed`.

## Order items

Только чтение:

- `GET /order-items` — все позиции всех заказов.
- `GET /order-items/:id` — позиция по её ID.

Для обычного экрана заказа предпочтительно использовать `GET /orders/:id/items`.

## Reservations

Endpoint-ы:

- `GET /reservations`
- `GET /reservations/:id`
- `POST /reservations`
- `PATCH /reservations/:id`
- `DELETE /reservations/:id`

Создание:

```json
{
  "orderId": "20",
  "warehouseId": "1",
  "variantId": "10",
  "quantity": "2.000",
  "expiresAt": "2026-09-14T13:00:00.000Z"
}
```

Новый резерв всегда создаётся со статусом `active`. Backend проверяет доступный остаток и атомарно увеличивает `inventory.reservedQty`.

Изменение количества активного резерва:

```json
{ "quantity": "3.000" }
```

Завершение резерва:

```json
{ "status": "consumed" }
```

Переходы из `active`:

- `consumed` — снимает резерв, списывает физический остаток и создаёт движение `sale`;
- `released` — только снимает резерв;
- `expired` — только снимает резерв.

После выхода из `active` статус менять нельзя. `orderId`, `warehouseId` и `variantId` неизменяемы. Удаление активного резерва освобождает количество; consumed-резерв удалить нельзя.

## Payments

Endpoint-ы:

- `GET /payments`
- `GET /payments/:id`
- `POST /payments`
- `PATCH /payments/:id`
- `DELETE /payments/:id`

Создание:

```json
{
  "orderId": "20",
  "provider": "bank-of-georgia",
  "providerReference": "optional-provider-id",
  "amount": "2599.98",
  "currency": "GEL"
}
```

Новый платёж всегда имеет статус `pending`. Сумма и валюта должны полностью совпадать с заказом. Для одного заказа одновременно разрешён только один pending, authorized или paid платёж.

Изменение статуса:

```json
{
  "status": "authorized",
  "providerReference": "provider-operation-123"
}
```

Допустимые переходы:

- `pending → authorized | paid | failed | cancelled`
- `authorized → paid | failed | cancelled`
- `paid → refunded`

Остальные статусы терминальные. При `paid`, `failed`, `cancelled` и `refunded` backend синхронизирует статус заказа. Поля `orderId`, `provider`, `amount`, `currency` и `paidAt` нельзя произвольно изменять.

## Warehouse transfers

Endpoint-ы:

- `GET /transfers`
- `GET /transfers/:id`
- `POST /transfers`
- `PATCH /transfers/:id`
- `DELETE /transfers/:id`

Создание черновика:

```json
{
  "sourceWarehouseId": "1",
  "destinationWarehouseId": "2",
  "items": [
    { "variantId": "10", "quantity": "5.000" },
    { "variantId": "11", "quantity": "2.000" }
  ],
  "note": "Restock Batumi warehouse"
}
```

Новый перевод всегда создаётся как `draft`. Склады должны различаться. Состав можно менять только пока перевод остаётся черновиком.

Каждый переход выполняется отдельным запросом:

```json
{ "status": "approved" }
```

```json
{ "status": "in_transit" }
```

```json
{ "status": "received" }
```

Допустимый workflow:

- `draft → approved → in_transit → received`
- `draft → cancelled`
- `approved → cancelled`

При `in_transit` товар атомарно списывается с исходного склада и создаются движения `transfer_out`. При `received` товар приходуется на целевой склад и создаются движения `transfer_in`. `shippedAt` и `receivedAt` выставляются backend. Удалять можно только `draft` и `cancelled`.

## Пример клиента

```ts
const API_URL = 'http://localhost:3000/api';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```
