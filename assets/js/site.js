/* ==========================================================================
   Untether — subpage runtime
   Powers the shared decoy pages: active-nav highlighting, footer year stamp,
   single-open FAQ accordions, and the client-side intake ("request access")
   form flow. Namespaced under UT.* to avoid clobbering globals.

   NOTE: this file deliberately contains NO easter-egg logic. The "tung" unlock
   and all hidden features live only in index.html; these subpages are pure decoy.
   ========================================================================== */
(function () {
  "use strict";

  var UT = (window.UT = window.UT || {});

  /* highlight the nav link matching the current page */
  UT.markActiveNav = function () {
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var links = document.querySelectorAll(".nav a[href]");
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute("href") || "").toLowerCase();
      if (href === here) links[i].classList.add("is-active");
    }
  };

  /* stamp the current year into footer copyright ([data-year]) */
  UT.stampYear = function () {
    var nodes = document.querySelectorAll("[data-year]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = new Date().getFullYear();
  };

  /* FAQ accordions: opening one panel closes its siblings in the same group */
  UT.singleOpenAccordions = function () {
    var groups = document.querySelectorAll("[data-accordion]");
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        var items = group.querySelectorAll("details.faq");
        for (var i = 0; i < items.length; i++) {
          items[i].addEventListener("toggle", function () {
            if (!this.open) return;
            for (var j = 0; j < items.length; j++) {
              if (items[j] !== this) items[j].open = false;
            }
          });
        }
      })(groups[g]);
    }
  };

  /* -----------------------------------------------------------------
     Intake ("request deployment access") form

     Ships without a server: the handler runs the full client-side flow
     (validation, pending state, reference issue, confirmation panel) and
     resolves locally. Point POST_ENDPOINT at a real service to wire it up;
     the success path already expects a { reference } response shape.
     ----------------------------------------------------------------- */
  var POST_ENDPOINT = null; // e.g. "/api/intake"

  // Reference format: UT-<year>-<5 chars>
  function issueReference() {
    var alphabet = "ACDEFGHJKLMNPQRTUVWXY3479";
    var tail = "";
    for (var i = 0; i < 5; i++) tail += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return "UT-" + new Date().getFullYear() + "-" + tail;
  }

  function nextBusinessDay() {
    var d = new Date();
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }

  function escapeHTML(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function confirmationMarkup(details) {
    return (
      '<div class="intake-confirm" role="status" tabindex="-1">' +
      '<div class="intake-confirm-mark" aria-hidden="true">&#10003;</div>' +
      "<h3>Your request has been received.</h3>" +
      "<p>Thank you, " + escapeHTML(details.name) + ". Your deployment brief has been " +
      "logged and a solutions engineer has your request in the queue.</p>" +
      '<dl class="kv intake-confirm-kv">' +
      "<dt>Reference</dt><dd class=\"mono\">" + details.reference + "</dd>" +
      "<dt>Brief sent to</dt><dd>" + escapeHTML(details.email) + "</dd>" +
      "<dt>Engineer response by</dt><dd>" + details.responseBy + "</dd>" +
      "</dl>" +
      "<h4>What happens next</h4>" +
      "<ol class=\"intake-steps\">" +
      "<li>The connectivity &amp; needs assessment is in your inbox now. It takes " +
      "most sites 20&ndash;40 minutes and does not require any hardware to complete.</li>" +
      "<li>Return it whenever you are ready. We size a content-pack and hardware " +
      "footprint within one business day of receipt.</li>" +
      "<li>A solutions engineer contacts you to walk through the proposed " +
      "deployment, the sync topology, and an estimated per-site cost.</li>" +
      "</ol>" +
      "<p class=\"muted\">Quote your reference in any correspondence. If the " +
      "assessment has not arrived within the hour, check your spam filter and " +
      "then contact us directly.</p>" +
      "</div>"
    );
  }

  function fieldLabel(field) {
    var label = field.form.querySelector('label[for="' + field.id + '"]');
    return label ? label.textContent.trim() : "This field";
  }
  function showError(form, message) {
    var box = form.querySelector("[data-intake-error]");
    if (!box) return;
    box.textContent = message; box.hidden = false;
  }
  function clearError(form) {
    var box = form.querySelector("[data-intake-error]");
    if (box) box.hidden = true;
  }
  function validate(form) {
    var required = form.querySelectorAll("[required]");
    for (var i = 0; i < required.length; i++) {
      var field = required[i];
      if (!field.value.trim()) { field.focus(); return fieldLabel(field) + " is required."; }
      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())) {
        field.focus(); return "Enter an email address the assessment can be sent to.";
      }
    }
    return null;
  }
  function complete(form, details) {
    var panel = document.createElement("div");
    panel.innerHTML = confirmationMarkup(details);
    var confirm = panel.firstChild;
    form.parentNode.replaceChild(confirm, form);
    confirm.focus();
  }

  UT.bindForms = function () {
    var forms = document.querySelectorAll("form[data-intake]");
    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener("submit", function (e) {
        e.preventDefault();
        var form = this;
        var problem = validate(form);
        if (problem) { showError(form, problem); return; }
        clearError(form);

        var button = form.querySelector('button[type="submit"]');
        var restore = button ? button.textContent : "";
        if (button) { button.disabled = true; button.textContent = "Submitting…"; }

        var details = {
          name: (form.querySelector("[name=pn]") || {}).value || "",
          email: (form.querySelector("[name=em]") || {}).value || "",
          reference: issueReference(),
          responseBy: nextBusinessDay()
        };

        var request = POST_ENDPOINT
          ? fetch(POST_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) }).then(function (r) { return r.json(); })
          : new Promise(function (resolve) { window.setTimeout(function () { resolve({ reference: details.reference }); }, 900); });

        request.then(function (response) {
          if (response && response.reference) details.reference = response.reference;
          complete(form, details);
        }).catch(function () {
          if (button) { button.disabled = false; button.textContent = restore; }
          showError(form, "That did not go through. Try again, or email us directly.");
        });
      });
    }
  };

  function boot() {
    UT.markActiveNav();
    UT.stampYear();
    UT.singleOpenAccordions();
    UT.bindForms();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
