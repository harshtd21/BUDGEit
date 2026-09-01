var App = App || {};

App.about = (function () {
  var u = App.utils;

  var CURRENCIES = [
    { code: "INR", label: "Indian Rupee (₹)" },
    { code: "USD", label: "US Dollar ($)" },
    { code: "EUR", label: "Euro (€)" },
    { code: "GBP", label: "British Pound (£)" },
    { code: "AED", label: "UAE Dirham (AED)" },
    { code: "SGD", label: "Singapore Dollar (S$)" },
    { code: "AUD", label: "Australian Dollar (A$)" },
    { code: "CAD", label: "Canadian Dollar (C$)" },
    { code: "JPY", label: "Japanese Yen (¥)" },
  ];

  function render(container) {
    var code = u.getCurrency();
    var label = (CURRENCIES.find(function (c) { return c.code === code; }) || { label: code }).label;

    container.innerHTML =
      '<div class="section-header">About</div>' +
      '<div class="about-card">' +
      '<div class="about-title">Budget</div>' +
      '<div class="about-tagline">Personal, private, offline expense tracker. No ads, no accounts, no data leaves your device.</div>' +
      "</div>" +
      '<div class="item-list" style="margin-top:10px;">' +
      '<div class="item-row" id="currency-row">' +
      '<div class="item-title">Currency</div>' +
      '<div class="item-value">' + u.escapeHtml(label) + "</div>" +
      "</div>" +
      "</div>";

    container.querySelector("#currency-row").addEventListener("click", function () {
      openCurrencyPicker(container);
    });
  }

  function openCurrencyPicker(container) {
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>Currency</h2>" +
      '<span style="width:52px;"></span>' +
      "</div>" +
      '<div class="form-body">' +
      '<div class="item-list">' +
      CURRENCIES.map(function (c) {
        return (
          '<div class="item-row" data-code="' + c.code + '">' +
          '<div class="item-title">' + u.escapeHtml(c.label) + "</div>" +
          (c.code === u.getCurrency() ? '<div class="item-value">✓</div>' : "") +
          "</div>"
        );
      }).join("") +
      "</div>" +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
        return;
      }
      var row = e.target.closest("[data-code]");
      if (!row) return;
      var code = row.getAttribute("data-code");
      App.db.saveSettings({ currency: code }).then(function () {
        u.setCurrency(code);
        overlay.remove();
        render(container);
        if (App.app) App.app.refreshActiveTab();
      });
    });
  }

  return { render: render };
})();
