# 🛒 Shopify Cart Feature

A highly optimized, customized cart system built on top of the standard Shopify Dawn Theme. This repository replaces default Shopify cart notifications and drawer experiences with interactive, conversion-boosting cart features. It integrates seamlessly with Shopify's **AJAX Cart API**, supporting a dynamic cart drawer, automated cart recalculations, visual incentives, and checkout optimization tools.

---

## 📌 Project Overview

This project extends Shopify theme capabilities with premium features aimed at increasing Average Order Value (AOV) and improving conversion rates. It is designed to work out of the box with the **Shopify Dawn** theme or other Online Store 2.0 themes.

### Key Highlights:
*   **Dynamic Cart Drawer:** A modern, sliding overlay for a seamless shopping flow.
*   **Interactive Free Shipping Bar:** An animated progress bar that updates in real-time to show how close the customer is to unlocking free shipping.
*   **Coupon Dashboard & Discount Copying:** A curated list of available coupon codes displaying active/locked states based on cart totals, allowing users to copy active codes directly.
*   **Cart Savings Box:** A visual display summarizing the total savings accumulated from sale prices and comparison rates.
*   **Zero-Reload Updates:** Fast, AJAX-driven updates for quantities, item removals, and state refreshes.

---

## 🚀 Features

### 1. 🚚 Real-Time Free Shipping Progress Bar
*   **Visual Incentive:** Displays a progress bar and a moving truck marker representing cart total relative to the shipping threshold.
*   **State Animation:** The bar transition switches themes from warning colors (orange/gold) to success green with a checkmark icon once the free shipping limit is reached.
*   **Shopify Settings Controlled:** The target shipping threshold is configurable via the theme customizer.
*   **AJAX Integration:** Fully synchronized with cart updates so changes are instantly reflected without reloading the page.

### 2. 🎟️ Intelligent Coupon & Discount Display
*   **Eligible Codes List:** Renders up to 5 discount codes directly inside the cart drawer.
*   **Dynamic Unlocking:** Automatically checks the cart value against configured code minimums. Shows a "Locked" state if the threshold isn't met, showing the customer exactly how much more to add.
*   **Copy-to-Clipboard Functionality:** Active codes feature a click-to-copy button with modern Clipboard API fallback and temporary "Copied" feedback.

### 3. 💰 Live Cart Savings Calculator
*   **Comparison Engine:** Iterates over cart items to compare item `final_price` against its `compare_at_price`.
*   **Aggregate Display:** Computes total cart savings and displays them in a clean visual card to reinforce the customer's buying decision.

### 4. 🔄 AJAX-Driven State Management
*   **Optimized Performance:** Uses Shopify's Section Rendering API to fetch and repaint only specific cart DOM sections (`cart-drawer-items`, `.cart-drawer__footer`, etc.).
*   **PubSub Architecture:** Built on Dawn's Publish/Subscribe event system, ensuring that adding or removing products, modifying quantities, or clearing the cart updates all shipping bars and discount panels simultaneously.

---

## 📂 Project Structure

Here is a breakdown of the key files implementing this feature:

```bash
Shopify-Cart-feature/
├── assets/
│   ├── cart.js                      # Centralized cart scripts (handles AJAX, Shipping Bar, & Clipboard Copying)
│   ├── cart-drawer.js               # Toggle operations and focus trap utilities for the slide-out drawer
│   ├── component-cart-drawer.css    # Typography, animations, and layouts for the cart drawer
│   ├── component-progress-bar.css   # Styling configurations for progress meters
│   └── base.css                     # Primary styles including variables for shipping bars and savings boxes
│
├── config/
│   └── settings_schema.json         # Customize theme configuration settings (toggles, discounts, thresholds)
│
├── sections/
│   ├── main-cart-items.liquid       # Main cart page items list
│   ├── main-cart-footer.liquid      # Main cart page subtotal & footer layout
│   └── cart-drawer.liquid           # Cart drawer wrapper section
│
├── snippets/
│   ├── cart-drawer.liquid           # Primary slide-out panel layout including shipping bar & coupon dashboard
│   ├── free-shipping-bar.liquid     # Shipping progress HTML markup and progress tracker
│   ├── eligible-discount-codes.liquid # Logic for assessing and rendering coupon active/locked states
│   └── cart-savings.liquid          # Savings calculation markup
```

---

## 🛠️ Theme Settings Configuration

The cart feature exposes clean customization settings within the Shopify Theme Customizer. In `config/settings_schema.json`, look for the `"name": "t:settings_schema.cart.name"` block to find settings for:

*   **Show Cart Savings (`show_cart_saving`):** Checkbox to display the total savings box.
*   **Free Shipping Target (`free_shipping_threshold`):** Number field to define target amount (e.g., `100` for $100.00).
*   **Show Eligible Discount Codes (`show_eligible_discount_codes`):** Checkbox to enable the coupon dashboard in the drawer.
*   **Discount Code Slots (1 to 5):**
    *   `eligible_discount_code_X` (Text: Code string like `FIRST10`)
    *   `eligible_discount_minimum_X` (Number: Minimum cart price to unlock code)
    *   `eligible_discount_description_X` (Text: Custom description or discount details)

---

## 💻 Installation & Setup

To integrate this custom cart feature into a Shopify store:

### 1. Clone the Repository
```bash
git clone https://github.com/mayur0711/Shopify-Cart-feature.git
cd Shopify-Cart-feature
```

### 2. Upload to Shopify Theme
You can upload the contents of `assets`, `sections`, `snippets`, and `config` to your active Shopify store:
*   **Method A: Shopify CLI (Recommended)**
    ```bash
    shopify theme push --store=your-store-domain.myshopify.com
    ```
*   **Method B: Manual Upload**
    1. Log into your **Shopify Admin**.
    2. Go to **Online Store → Themes**.
    3. Click on the three dots next to your theme and select **Edit Code**.
    4. Copy-paste the relevant liquid, css, and js code blocks to corresponding files, or merge changes into your theme's existing codebase.

---

## ⚙️ JavaScript API Highlights

### `updateFreeShippingBar(cartData)`
Determines whether to trigger rendering based on passed cart events or pull fresh data from the Shopify `/cart.js` API on page load. Keeps elements in sync on the main cart page and sliding drawer:
```javascript
function updateFreeShippingBar(cartData) {
  if (cartData && typeof cartData.total_price === 'number') {
    renderFreeShippingBars(cartData);
    return;
  }
  fetch(`${routes.cart_url}.js`)
    .then((response) => response.json())
    .then(renderFreeShippingBars)
    .catch((error) => console.warn(error));
}
```

### `copyTextToClipboard(text)`
Copies active coupon codes to the clipboard using the HTML5 `navigator.clipboard` API with an automatic fallback block utilizing a virtual offscreen `<textarea>` for legacy browser compatibility.

---

## 👨‍💻 Developer & Author

*   **Mayur Saraiya**
---

## ⭐ Support & License

*   If you find this project helpful for your Shopify development, please give it a ⭐ on GitHub!
*   This code is open-source and licensed under the **MIT License**.
