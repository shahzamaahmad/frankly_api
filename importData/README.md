
# Inventory MongoDB Migration Scripts

This folder contains Node.js scripts to import CSV data from Google Sheets into MongoDB.

## Instructions

1. Copy your exported Google Sheets CSVs into this folder. Name them exactly as the scripts expect, e.g.:
   - `inventory.csv`
   - `transactions.csv`
   - `transactionItems.csv`
   - `sites.csv`
   - `deliveries.csv`
   - `deliveryItems.csv`
   - `users.csv`

2. Ensure MongoDB is running and `.env` exists with `MONGODB_URI`.

3. Install dependencies if not done:
```
npm install mongoose csv-parser dotenv
```

4. Run each script to import data:
```
node import_inventory.js
node import_sites.js
node import_transactions.js
node import_transactionItems.js
node import_deliveries.js
node import_deliveryItems.js
node import_users.js
```

5. Check MongoDB Compass or your API to verify data.

**Note:** For tables with references (Transaction Items, Delivery Items), ensure the parent tables are imported first and update the CSV to use ObjectIds if needed.
