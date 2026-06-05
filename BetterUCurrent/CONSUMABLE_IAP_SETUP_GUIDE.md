# Consumable In-App Purchase Setup Guide
## Setting Up 10,000 Neuros Purchase for iOS

This guide walks you through setting up a consumable in-app purchase that allows users to buy 10,000 Neuros (your in-app currency) for $1.99 USD.

---

## 📋 Prerequisites

- ✅ Apple Developer Account (already set up)
- ✅ Banking information filled out in App Store Connect
- ✅ In-App Purchase Agreement signed
- ✅ RevenueCat account configured
- ✅ App already has RevenueCat SDK integrated

---

## 🍎 Step 1: Create Product in App Store Connect

### 1.1 Navigate to Your App
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Click on **"Features"** in the left sidebar
4. Click on **"In-App Purchases"**

### 1.2 Create New In-App Purchase
1. Click the **"+"** button to create a new in-app purchase
2. Select **"Consumable"** as the product type
   - **Why Consumable?** Consumables can be purchased multiple times (unlike non-consumables which can only be purchased once). This is perfect for currency purchases.

### 1.3 Fill in Product Information

**Reference Name:**
- `10,000 Neuros Pack`
- (This is for your internal reference only)

**Product ID:**
- **IMPORTANT:** Use exactly: `neuros_10000`
- This must match what's in the code (`lib/purchases.js`)
- If you change this, you must update the code too!

**Price:**
- Set to **$1.99 USD** (or your desired price)
- You can change this later without code changes

### 1.4 Localization (Required)
Click **"Add Localization"** and fill in:

**Display Name:**
- `10,000 Neuros`

**Description:**
- `Purchase 10,000 Neuros to unlock exclusive themes and features in the app.`

**Note:** You can add more localizations for other languages later.

### 1.5 Review Information
- **Review Notes:** (Optional) Add any notes for Apple reviewers
- **Screenshot:** (Optional) Add a screenshot showing the purchase in your app

### 1.6 Save and Submit
1. Click **"Save"**
2. The product will be in **"Ready to Submit"** status
3. You don't need to submit it separately - it will be reviewed when you submit your app

---

## 🎯 Step 2: Configure Product in RevenueCat

### 2.1 Navigate to Products
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Select your project
3. Click on **"Products"** in the left sidebar

### 2.2 Add Product
1. Click **"Add Product"** or **"Create Product"**
2. Enter the **Product ID**: `neuros_10000`
   - This must match exactly what you set in App Store Connect
3. Select **"Consumable"** as the product type
4. Click **"Create"**

### 2.3 Configure Product Details
- **Display Name:** `10,000 Neuros Pack`
- **Description:** (Optional) Add a description

### 2.4 Link to App Store Connect
RevenueCat should automatically detect the product from App Store Connect if:
- Your app is properly linked in RevenueCat
- The Product ID matches exactly

If it doesn't auto-detect:
1. Go to **"Integrations"** → **"App Store Connect"**
2. Make sure your app is connected
3. RevenueCat will sync products automatically

---

## 💻 Step 3: Code Configuration (Already Done!)

The code has been updated with the following:

### 3.1 New Functions in `lib/purchases.js`

**`getProduct(productIdentifier)`**
- Fetches product information from RevenueCat
- Used to get price and display info

**`purchaseConsumable(productIdentifier)`**
- Handles the purchase flow for consumables
- Different from subscriptions - uses `purchaseProduct()` instead of `purchasePackage()`

**`handleConsumablePurchase(customerInfo, productIdentifier)`**
- Credits Neuros to user's account after successful purchase
- Maps product IDs to Neuros amounts
- Records purchase in database for analytics

### 3.2 Product ID Mapping

In `lib/purchases.js`, there's a mapping:
```javascript
const NEUROS_PRODUCT_MAP = {
  'neuros_10000': 10000, // 10,000 Neuros for $1.99
  // Add more products here as needed
};
```

**To add more products (e.g., 5,000 or 20,000 Neuros):**
1. Create new products in App Store Connect with IDs like `neuros_5000`, `neuros_20000`
2. Add them to RevenueCat
3. Add them to the `NEUROS_PRODUCT_MAP` in the code
4. Update the UI in `app/store.js` to show multiple options

### 3.3 Database Migration

A new table `consumable_purchases` has been created to:
- Track all consumable purchases for analytics
- Prevent duplicate credits (using transaction IDs)
- Store purchase history

**To apply the migration:**
```bash
# If using Supabase CLI
supabase migration up

# Or apply manually in Supabase Dashboard
# Go to SQL Editor and run the migration file:
# supabase/migrations/20250221000011_create_consumable_purchases_table.sql
```

### 3.4 UI Component

A purchase button has been added to `app/store.js`:
- Shows product price dynamically
- Only appears on iOS
- Handles loading and error states
- Refreshes balance after purchase

---

## 🧪 Step 4: Testing

### 4.1 Test in Sandbox Environment

**Important:** You must test with a sandbox tester account, not your real Apple ID.

1. **Create Sandbox Tester:**
   - App Store Connect → **"Users and Access"** → **"Sandbox Testers"**
   - Create a new tester (use a different email than your Apple ID)

2. **Test on Device:**
   - Sign out of your Apple ID in Settings → App Store
   - Build and run your app on a physical device (not simulator)
   - When prompted, sign in with the sandbox tester account
   - Try purchasing the 10,000 Neuros pack

3. **Verify:**
   - Check that Neuros are credited to the account
   - Check the `consumable_purchases` table in Supabase
   - Verify the balance updates in the app

### 4.2 Common Issues

**"Product not found"**
- Check that Product ID matches exactly: `neuros_10000`
- Verify product is created in App Store Connect
- Check RevenueCat dashboard to see if product is synced
- Wait a few minutes after creating - Apple/RevenueCat need time to sync

**"Purchase fails silently"**
- Check device logs for errors
- Verify sandbox tester is signed in
- Make sure you're testing on a real device (not simulator)

**"Neuros not credited"**
- Check `handleConsumablePurchase` function logs
- Verify the product ID is in `NEUROS_PRODUCT_MAP`
- Check Supabase logs for errors
- Verify user is authenticated

---

## 💰 Step 5: Changing the Price Later

**Good news:** You can change the price without code changes!

### 5.1 Update Price in App Store Connect
1. Go to App Store Connect → Your App → In-App Purchases
2. Click on your product (`neuros_10000`)
3. Click **"Edit"** next to the price
4. Select new price tier
5. Click **"Save"**

### 5.2 What Happens
- RevenueCat will automatically sync the new price
- Your app will show the new price (fetched dynamically)
- No code changes needed!
- The amount of Neuros (10,000) stays the same - only the price changes

**Note:** Price changes may take a few minutes to propagate through Apple's systems.

---

## 📦 Step 5.5: Adding More Neuros Packs (1,000 / 5,000 / etc.) and Changing Prices

### Changing the price of an existing product (e.g. 10,000 Neuros)

1. **App Store Connect**
   - Go to **App Store Connect** → Your App → **In-App Purchases**.
   - Click the product (e.g. `neuros_10000`).
   - Under **Pricing**, click **Edit** (or the price).
   - Choose a new **Price Tier** (e.g. $2.99, $4.99) or set a custom price.
   - Save. RevenueCat and the app will show the new price automatically; no code change.

2. **Code**
   - The **amount of Neuros** (10,000) is defined in code. To change how many Neuros the user gets for that product, edit `lib/purchases.js` → `NEUROS_PRODUCT_MAP` and `app/store.js` (the `neurosMap` used for display). The **price** is always read from the store, so you only change code if you want to change the Neuros amount for that product ID.

### Adding new products (e.g. 1,000 Neuros, 5,000 Neuros)

1. **App Store Connect**
   - **In-App Purchases** → **+** → **Consumable**.
   - **Reference name:** e.g. `1,000 Neuros Pack` (internal only).
   - **Product ID:** must match what you use in code, e.g. `neuros_1000`, `neuros_5000`.
   - Set **price** (e.g. $0.99 for 1,000, $1.49 for 5,000).
   - Add at least one **localization** (display name + description).
   - Save. Status will be "Ready to Submit"; it goes to review with your app.

2. **RevenueCat**
   - **Products** → **Add Product**.
   - **Product ID:** same as App Store Connect (e.g. `neuros_1000`, `neuros_5000`).
   - Type: **Consumable**. Save. RevenueCat will sync from App Store Connect.

3. **Code**
   - **`lib/purchases.js`**  
     In `handleConsumablePurchase`, add the new IDs to `NEUROS_PRODUCT_MAP`:
     ```js
     const NEUROS_PRODUCT_MAP = {
       'neuros_1000': 1000,
       'neuros_5000': 5000,
       'neuros_10000': 10000,
       'neuros_30000': 30000,
       'neuros_100000': 100000,
     };
     ```
   - **`app/store.js`**  
     - In `loadNeurosProducts`, include the new product IDs in the array you pass to the API (e.g. add `'neuros_1000'`, `'neuros_5000'` to `productIds`).
     - In the display logic, add the new IDs to the `neurosMap` object (e.g. `'neuros_1000': 1000`, `'neuros_5000': 5000`) so the correct amount shows on the card.

After that, the new packs will appear in the Store and credit the correct Neuros when purchased. No new database migrations are required.

---

## 📊 Step 6: Monitoring and Analytics

### 6.1 RevenueCat Dashboard
- View purchase metrics in RevenueCat
- See conversion rates
- Track revenue

### 6.2 Supabase Database
Query the `consumable_purchases` table:
```sql
-- Total Neuros sold
SELECT SUM(neuros_amount) FROM consumable_purchases;

-- Purchases per user
SELECT user_id, COUNT(*) as purchase_count, SUM(neuros_amount) as total_neuros
FROM consumable_purchases
GROUP BY user_id
ORDER BY total_neuros DESC;

-- Recent purchases
SELECT * FROM consumable_purchases
ORDER BY purchase_date DESC
LIMIT 10;
```

---

## 🔒 Step 7: Security Considerations

### 7.1 Server-Side Validation (Recommended for Production)

Currently, the purchase is validated client-side. For production, consider:

1. **Webhook from RevenueCat:**
   - Set up a webhook endpoint in RevenueCat
   - RevenueCat will send purchase events to your server
   - Validate and credit Neuros server-side
   - This prevents fraud and ensures purchases are legitimate

2. **Receipt Validation:**
   - Validate receipts with Apple's servers
   - Check for duplicate transactions
   - Verify purchase authenticity

### 7.2 Duplicate Prevention

The code already includes:
- Transaction ID tracking in `consumable_purchases` table
- Unique constraint on `(transaction_id, user_id)`
- This prevents the same purchase from crediting Neuros twice

---

## 🚀 Step 8: Going Live

### 8.1 Pre-Launch Checklist
- [ ] Product created in App Store Connect
- [ ] Product configured in RevenueCat
- [ ] Tested with sandbox account
- [ ] Database migration applied
- [ ] Price set correctly ($1.99)
- [ ] Product description and display name finalized

### 8.2 Submit for Review
- When you submit your app update, Apple will review the in-app purchase
- Make sure your app clearly shows what users get (10,000 Neuros)
- Include screenshots if helpful

### 8.3 After Approval
- Product will be live immediately
- Users can purchase 10,000 Neuros for $1.99
- Monitor RevenueCat dashboard for purchases
- Check Supabase for purchase records

---

## 📝 Important Notes

### Product ID
- **Current:** `neuros_10000`
- **Location in code:** `lib/purchases.js` → `NEUROS_PRODUCT_MAP`
- **If you change it:** Update both App Store Connect AND the code

### Price
- **Current:** $1.99 USD
- **Can change:** Yes, in App Store Connect (no code changes needed)
- **Neuros amount:** Fixed at 10,000 (change in code if needed)

### Platform
- **Currently:** iOS only
- **Android:** Can be added later (similar process with Google Play Console)

### Adding More Products
To add more Neuros packs (e.g., 5,000 or 20,000):
1. Create new products in App Store Connect
2. Add to RevenueCat
3. Update `NEUROS_PRODUCT_MAP` in code
4. Update UI in `store.js` to show multiple options

---

## 🆘 Troubleshooting

**Product not showing in app:**
- Wait 5-10 minutes after creating in App Store Connect
- Check RevenueCat dashboard - is product synced?
- Verify Product ID matches exactly
- Check device logs for errors

**Purchase completes but Neuros not credited:**
- Check `handleConsumablePurchase` function logs
- Verify product ID is in `NEUROS_PRODUCT_MAP`
- Check Supabase for errors
- Verify user is authenticated

**Price shows as wrong:**
- RevenueCat caches prices - wait a few minutes
- Force close and reopen app
- Check App Store Connect price is correct

---

## 📞 Support

If you encounter issues:
1. Check RevenueCat documentation: https://docs.revenuecat.com
2. Check Apple's IAP documentation
3. Review device logs for specific errors
4. Check Supabase logs for database errors

---

## ✅ Summary

You now have:
- ✅ Consumable IAP product configured
- ✅ Code to handle purchases
- ✅ UI to purchase Neuros
- ✅ Database tracking
- ✅ Ability to change price without code changes

**Next Steps:**
1. Create product in App Store Connect (Step 1)
2. Configure in RevenueCat (Step 2)
3. Apply database migration (Step 3.3)
4. Test with sandbox account (Step 4)
5. Submit app update for review

Good luck! 🎉
