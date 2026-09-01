var App = App || {};

App.about = (function () {
  function render(container) {
    container.innerHTML =
      '<div class="section-header">About</div>' +
      '<div class="about-card">' +
      '<div class="about-title">Budget</div>' +
      '<div class="about-tagline">Personal, private, offline expense tracker. No ads, no accounts, no data leaves your device.</div>' +
      "</div>";
  }

  return { render: render };
})();
