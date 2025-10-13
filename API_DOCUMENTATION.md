# API Endpoints (Dictionary)

All endpoints are prefixed with `/api` and most require Authorization header: `Authorization: Bearer <token>` (except `/api/auth/*`).

## Auth

- POST /api/auth/signup
  - Body: { name, username, password, role?, email?, mobile? }
  - Creates a user.
- POST /api/auth/login
  - Body: { username, password }
  - Returns: { token, user }

## Inventory

- POST /api/inventory
  - Form-data or JSON. fields: sku, itemName, type, origin, initialStock, currentStock, uom, size, remark
  - Optionally upload `image` file (multipart/form-data) OR send `imageBase64` and `imageContentType` in JSON.
- GET /api/inventory
  - Query params: ?type=... & ?origin=...
- GET /api/inventory/:id
- PUT /api/inventory/:id
- PATCH /api/inventory/:id
- DELETE /api/inventory/:id

## Sites

- POST /api/sites { name, sector, location, ... }
- GET /api/sites
- GET /api/sites/:id
- PUT /api/sites/:id
- DELETE /api/sites/:id

## Transactions

- POST /api/transactions
  - Body: { transactionId, taker, site (ObjectId) OR siteName (string), outDate, inDate, returnee, remark }
  - If siteName provided and site not exists — site will be created automatically
- GET /api/transactions
- GET /api/transactions/:id
- PUT /api/transactions/:id
- DELETE /api/transactions/:id

## Transaction Items

- POST /api/transaction-items
  - Body: { transactionItemId, transactionId (ObjectId), item (ObjectId) OR itemSku (string), outQuantity, inQuantity, outDate, inDate, remark }
- GET /api/transaction-items?transactionId=...
- GET /api/transaction-items/:id
- PUT /api/transaction-items/:id
- DELETE /api/transaction-items/:id

## Deliveries

- POST /api/deliveries
  - Form-data or JSON. fields: deliveryId, deliveryDate, Seller, amount, receivedBy, remarks
  - Optionally upload `invoice` file (multipart/form-data) OR send `invoiceBase64` with `invoiceContentType` and `invoiceFilename`.
- GET /api/deliveries
- GET /api/deliveries/:id
- PUT /api/deliveries/:id
- DELETE /api/deliveries/:id

## Delivery Items

- POST /api/delivery-items
  - Body: { deliveryItemId, deliveryId (ObjectId), item (ObjectId) OR itemSku (string), quantity }
- GET /api/delivery-items?deliveryId=...
- GET /api/delivery-items/:id
- PUT /api/delivery-items/:id
- DELETE /api/delivery-items/:id

## Notes / Tips

- Images and invoices are stored as binary buffer in MongoDB. For large files or production you might prefer storing files in S3 (or similar) and saving URLs in DB.
- All models use `timestamps: true`, so createdAt and updatedAt fields are maintained automatically by Mongoose.
- Protect your `JWT_SECRET` and production DB credentials; do not commit `.env` to source control.
