var App = App || {};

App.profile = (function () {
  var u = App.utils;

  function render(container) {
    App.db.getProfile().then(function (p) {
      p = p || { name: "", email: "", phone: "" };
      container.innerHTML =
        '<div class="section-header">Self</div>' +
        '<div class="profile-card" id="profile-card">' +
        '<div class="profile-icon">👤</div>' +
        '<div class="profile-fields">' +
        '<div class="profile-name">' + (p.name ? u.escapeHtml(p.name) : '<span class="placeholder">Add your name</span>') + "</div>" +
        (p.email ? '<div class="profile-detail">' + u.escapeHtml(p.email) + "</div>" : "") +
        (p.phone ? '<div class="profile-detail">' + u.escapeHtml(p.phone) + "</div>" : "") +
        "</div>" +
        "</div>";

      container.querySelector("#profile-card").addEventListener("click", function () {
        openForm(p, container);
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

  return { render: render };
})();
