class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) ||
              document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });

          // Update custom cart banners immediately after Shopify returns the new cart state.
          updateFreeShippingBar(parsedState);

          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
        CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } }).then(() =>
              CartPerformance.measureFromEvent('note-update:user-action', event)
            );
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}


// Custom Cart feature scripts start here

// Converts Shopify cart cents into a customer-friendly currency string.
function formatFreeShippingMoney(cents, currency) {
  // Shopify stores money in cents, so divide by 100 for display.
  const amount = cents / 100;

  // Use the cart currency when available so the message matches the store market.
  if (currency) {
    try {
      // Intl formats the amount using the visitor's language and selected currency.
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch (error) {
      // If the browser cannot format the currency, log it and use the fallback below.
      console.warn(error);
    }
  }

  // Fallback format keeps the message readable if currency formatting fails.
  return `$${amount.toFixed(2)}`;
}

// Updates every free shipping bar on the page using the latest cart data.
function renderFreeShippingBars(cart) {
  // Find both cart drawer and cart page bars if both exist in the DOM.
  const bars = document.querySelectorAll('.free-shipping-bar');
  // Stop early when there is no bar or no cart data to render.
  if (!bars.length || !cart) return;

  // Loop through each bar so drawer and cart page stay in sync.
  bars.forEach((bar) => {
    // Hide the bar when the cart is empty.
    if (cart.item_count === 0) {
      bar.hidden = true;
      bar.style.display = 'none';
      return;
    }

    // Read the free shipping target from the Liquid data attribute.
    const threshold = Number(bar.dataset.freeShippingThreshold);
    // Stop if the threshold is missing or invalid.
    if (!threshold) return;

    // Normalize the cart total so calculations work even if the API sends an empty value.
    const cartTotal = Number(cart.total_price || 0);
    // Calculate how much more the customer needs to spend for free shipping.
    const amountLeft = threshold - cartTotal;
    // Convert cart progress into a percentage and cap it at 100.
    const progress = Math.min((cartTotal / threshold) * 100, 100);
    // Track whether the customer has already reached the free shipping target.
    const isComplete = amountLeft <= 0;
    // Prefer live cart currency, then fall back to the Liquid-rendered currency.
    const currency = cart.currency || bar.dataset.freeShippingCurrency;
    // Get the message element that shows the main free shipping text.
    const message = bar.querySelector('.free-shipping-message');
    // Get the smaller supporting text under the main message.
    const detail = bar.querySelector('.free-shipping-detail');
    // Get the progressbar element so its accessible value can be updated.
    const track = bar.querySelector('.free-shipping-track');

    // Show the bar again when the cart has items.
    bar.hidden = false;
    bar.style.removeProperty('display');
    // Toggle the complete class to switch colors, icon, and animation.
    bar.classList.toggle('is-complete', isComplete);
    // Update the CSS variable that controls the fill width and truck marker position.
    bar.style.setProperty('--free-shipping-progress', `${progress}%`);

    // Keep the progressbar aria value accurate for screen readers.
    if (track) track.setAttribute('aria-valuenow', Math.round(progress));

    // Update the main message based on whether free shipping is unlocked.
    if (message) {
      if (isComplete) {
        // Show the success copy after the threshold is reached.
        message.innerHTML = '<span class="free-shipping-emphasis">Free shipping unlocked</span> for this order';
      } else {
        // Format the remaining amount before adding it to the message.
        const amount = formatFreeShippingMoney(amountLeft, currency);
        // Show how much more the customer needs to spend.
        message.innerHTML = `<span class="free-shipping-emphasis">You're ${amount} away</span> from free shipping`;
      }
    }

    // Update the smaller helper text for incomplete and complete states.
    if (detail) {
      detail.textContent = isComplete
        ? 'Your order is ready to ship on us.'
        : 'Add one more favorite and we will cover delivery.';
    }
  });
}

// Receives cart data from events, or fetches it once when the page first loads.
function updateFreeShippingBar(cartData) {
  // Use existing cart event data when available to avoid an extra network request.
  if (cartData && typeof cartData.total_price === 'number') {
    renderFreeShippingBars(cartData);
    return;
  }

  // On first page load, fetch the current cart so the bar starts accurate.
  fetch(`${routes.cart_url}.js`)
    // Convert the Shopify cart response into JSON.
    .then((response) => response.json())
    // Render the bar using the fetched cart data.
    .then(renderFreeShippingBars)
    // Log fetch errors without breaking the cart experience.
    .catch((error) => console.warn(error));
}

// Initialize the bar after the page HTML is ready.
document.addEventListener('DOMContentLoaded', () => updateFreeShippingBar());

// Listen to Dawn's cart update event so the bar changes after add/remove/quantity updates.
if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
  // Re-render using the cart data passed by the event.
  subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => updateFreeShippingBar(event?.cartData));
}

// Copies text using the modern Clipboard API with a textarea fallback.
function copyTextToClipboard(text) {
  // Use the Clipboard API when the browser allows it.
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  // Create a temporary textarea for older browsers.
  const textarea = document.createElement('textarea');
  // Put the requested text into the temporary textarea.
  textarea.value = text;
  // Keep the textarea off-screen so it does not visually affect the page.
  textarea.style.position = 'fixed';
  // Move it above the viewport to avoid scroll jumps.
  textarea.style.top = '-1000px';
  // Add the textarea to the page so the browser can select its value.
  document.body.appendChild(textarea);
  // Select the text that needs to be copied.
  textarea.select();
  // Copy the selected text into the clipboard.
  document.execCommand('copy');
  // Remove the temporary textarea after copying.
  textarea.remove();

  return Promise.resolve();
}

// Copies eligible discount codes from the cart drawer without needing to rebind after drawer updates.
document.addEventListener('click', async (event) => {
  // Only handle clicks on eligible discount code buttons.
  const discountButton = event.target.closest('[data-discount-code]');
  // Stop if the click was not on a discount code.
  if (!discountButton) return;

  // Read the code from the button data attribute.
  const discountCode = discountButton.dataset.discountCode;
  // Stop if the button does not have a usable code.
  if (!discountCode) return;

  try {
    // Copy the discount code before showing copied feedback.
    await copyTextToClipboard(discountCode);
  } catch (error) {
    // Log copy failures without blocking the cart drawer.
    console.warn(error);
    return;
  }

  // Mark the clicked code as copied for visual feedback.
  discountButton.classList.add('is-copied');
  // Temporarily change the button text so the customer knows the code was copied.
  discountButton.textContent = 'Copied';
  // Restore the original code after a short confirmation delay.
  setTimeout(() => {
    discountButton.classList.remove('is-copied');
    discountButton.textContent = discountCode;
  }, 1600);
});
