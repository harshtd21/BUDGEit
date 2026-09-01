var App = App || {};

App.profile = (function () {
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
    App.db.getProfile().then(function (p) {
      p = p || { name: "", email: "", phone: "" };
      var currencyCode = u.getCurrency();
      var currencyLabel = (CURRENCIES.find(function (c) { return c.code === currencyCode; }) || { label: currencyCode }).label;

      container.innerHTML =
        '<div class="section-header">Self</div>' +
        '<div class="profile-card" id="profile-card">' +
        '<div class="profile-icon">👤</div>' +
        '<div class="profile-fields">' +
        '<div class="profile-name">' + (p.name ? u.escapeHtml(p.name) : '<span class="placeholder">Add your name</span>') + "</div>" +
        (p.email ? '<div class="profile-detail">' + u.escapeHtml(p.email) + "</div>" : "") +
        (p.phone ? '<div class="profile-detail">' + u.escapeHtml(p.phone) + "</div>" : "") +
        "</div>" +
        "</div>" +
        '<div class="item-list" style="margin-top:10px;">' +
        '<div class="item-row" id="currency-row">' +
        '<div class="item-title">Currency</div>' +
        '<div class="item-value">' + u.escapeHtml(currencyLabel) + "</div>" +
        "</div>" +
        "</div>";

      container.querySelector("#profile-card").addEventListener("click", function () {
        openForm(p, container);
      });
      container.querySelector("#currency-row").addEventListener("click", function () {
        openCurrencyPicker(container);
      });
    });
  }

  function openForm(existing, container) {
    var overlay = document.createElement("div");
    overlay.className = "sheet-backdrop";
    overlay.innerHTML =
      '<div class="form-modal">' +
      '<div class="form-header">' +
      '<button type="button" class="form-cancel" data-action="close">Cancel</button>' +
      "<h2>Self</h2>" +
      '<button type="button" class="form-save" data-action="save">Save</button>' +
      "</div>" +
      '<div class="form-body">' +
      '<label class="field-label">Name</label>' +
      '<input type="text" class="field-input" id="p-name" value="' + u.escapeHtml(existing.name || "") + '">' +
      '<label class="field-label">Email</label>' +
      '<input type="email" class="field-input" id="p-email" value="' + u.escapeHtml(existing.email || "") + '">' +
      '<label class="field-label">Phone Number</label>' +
      '<input type="tel" class="field-input" id="p-phone" value="' + u.escapeHtml(existing.phone || "") + '">' +
      '<p class="field-error" id="p-error"></p>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (e.target === overlay || action === "close") {
        overlay.remove();
      } else if (action === "save") {
        var name = overlay.querySelector("#p-name").value.trim();
        var email = overlay.querySelector("#p-email").value.trim();
        var phone = overlay.querySelector("#p-phone").value.trim();
        App.db.saveProfile({ name: name, email: email, phone: phone, updatedAt: new Date().toISOString() }).then(function () {
          overlay.remove();
          render(container);
        });
      }
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
