/**
 * RAMSC Announcement Request Form (GitHub Pages)
 * Google sign-in (ID token) → validate → POST to Apps Script web app.
 */
"use strict";

// ── CONFIG: paste your two values here ────────────────────────────────────
const GOOGLE_CLIENT_ID = "571502076243-p9bp52t9k5cm3i8ifocn2rpadr8mhvnk.apps.googleusercontent.com";
const APPS_SCRIPT_URL  = "https://script.google.com/macros/s/AKfycbx2m9-JPl3wgAwDxYzo7nMa6amePbpmuNiMSHDoBJ_sqts01lpHzpyqQuQBvl1S2ODZIA/exec";
// ──────────────────────────────────────────────────────────────────────────

const ALLOWED_DOMAINS = ["@mahidol.ac.th", "@student.mahidol.ac.th", "@student.mahidol.edu"];

let idToken = null;      // Google-signed token, kept in memory only
let tokenExp = 0;        // expiry (unix seconds), used for UX only; server re-verifies

const $ = function (id) { return document.getElementById(id); };

// ── Sign-in ───────────────────────────────────────────────────────────────
function parseJwt(token) {
  const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(b64).split("").map(function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("")
  );
  return JSON.parse(json);
}

function isAllowedEmail(email) {
  email = (email || "").toLowerCase();
  return ALLOWED_DOMAINS.some(function (d) { return email.endsWith(d); });
}

function showSignedOut(msg) {
  idToken = null;
  tokenExp = 0;
  $("announcementForm").classList.add("hidden");
  $("signinView").classList.remove("hidden");
  $("signinError").textContent = msg || "";
}

function handleCredential(response) {
  let payload;
  try { payload = parseJwt(response.credential); }
  catch (e) { showSignedOut("Sign-in failed. Please try again."); return; }

  if (!payload.email_verified || !isAllowedEmail(payload.email)) {
    showSignedOut("Access denied: please use a valid @mahidol.ac.th, @student.mahidol.ac.th or @student.mahidol.edu account.");
    return;
  }

  idToken = response.credential;
  tokenExp = payload.exp || 0;
  $("userName").textContent = payload.name || payload.email;
  $("userEmail").textContent = payload.email;
  $("signinError").textContent = "";
  $("signinView").classList.add("hidden");
  $("announcementForm").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initGoogle() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    setTimeout(initGoogle, 150);   // the GSI script loads async
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: false,
    cancel_on_tap_outside: true
  });
  google.accounts.id.renderButton($("googleBtn"), {
    theme: "outline", size: "large", text: "signin_with", shape: "rectangular"
  });
}
initGoogle();

$("signOutBtn").addEventListener("click", function () {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  showSignedOut("");
});

// ── CSV / Formula injection guard (mirrors server-side) ───────────────────
const FORMULA_CHARS = new Set(["=", "+", "-", "@"]);

function sanitisePreview(value) {
  let v = value.trim();
  while (v.length > 0 && FORMULA_CHARS.has(v[0])) { v = v.slice(1).trim(); }
  return v;
}

function stripLeadingFormulaChars(value) {
  let i = 0;
  while (i < value.length && FORMULA_CHARS.has(value[i])) i++;
  return value.slice(i);
}

document.querySelectorAll("input[type=text], input[type=url], textarea")
  .forEach(function (el) {
    el.addEventListener("input", function () {
      const clean = stripLeadingFormulaChars(el.value);
      if (clean !== el.value) el.value = clean;
    });
  });

// ── Helpers ───────────────────────────────────────────────────────────────
function setError(id, msg) {
  const el = $("err-" + id);
  if (!el) return;
  el.textContent = msg || "";
  const input = $(id) || document.querySelector('[name="' + id + '"]');
  if (input) {
    if (msg) input.classList.add("ann-invalid");
    else     input.classList.remove("ann-invalid");
  }
}

function clearErrors() {
  document.querySelectorAll(".ann-error").forEach(function (el) {
    if (el.id !== "signinError") el.textContent = "";
  });
  document.querySelectorAll(".ann-invalid").forEach(function (el) { el.classList.remove("ann-invalid"); });
}

function showBanner(msg, type) {
  const b = $("statusBanner");
  b.textContent = msg;
  b.className = "ann-banner is-" + type;
  b.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideBanner() {
  const b = $("statusBanner");
  b.className = "ann-banner hidden";
  b.textContent = "";
}

function setLoading(on) {
  $("submitBtn").disabled = on;
  $("btnText").textContent = on ? "Submitting…" : "Submit Request";
  $("btnSpinner").classList.toggle("hidden", !on);
}

function isValidUrl(value) {
  if (!value) return true;
  try { new URL(value.startsWith("http") ? value : "https://" + value); return true; }
  catch (e) { return false; }
}

const TIME_PERIOD_RE = /^([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d$/;

// ── Submit ────────────────────────────────────────────────────────────────
$("announcementForm").addEventListener("submit", function (e) {
  e.preventDefault();
  clearErrors();
  hideBanner();

  if (!idToken || Date.now() / 1000 > tokenExp - 30) {
    showSignedOut("Your sign-in expired. Please sign in again (your form was not sent).");
    return;
  }

  const form          = e.target;
  const title         = sanitisePreview($("title").value);
  const eventDate     = $("event_date").value.trim();
  const timePeriod    = sanitisePreview($("time_period").value);
  const detail        = sanitisePreview($("detail").value);
  const imagesUrl     = $("images").value.trim();
  const broadcastDate = $("broadcast_date").value.trim();
  const lineId        = sanitisePreview($("line_id").value);
  
  const platforms  = Array.from(form.querySelectorAll("input[name=platforms]:checked"))
                          .map(function (cb) { return cb.value; });
  const categories = Array.from(form.querySelectorAll("input[name=categories]:checked"))
                          .map(function (cb) { return cb.value; });

  let hasError = false;
  if (!title)         { setError("title", "Title is required."); hasError = true; }
  if (!eventDate)     { setError("event_date", "Date is required.");   hasError = true; }
  
  if (!timePeriod) {
    setError("time_period", "Time is required."); hasError = true;
  } else if (!TIME_PERIOD_RE.test(timePeriod)) {
    setError("time_period", 'Use 24-hour format, e.g. "09:00 - 12:00".'); hasError = true;
  }
  
  if (!imagesUrl) {
    setError("images", "Image link is required."); hasError = true;
  } else {
    const firstLink = imagesUrl.split(',')[0].trim();
    if (!isValidUrl(firstLink)) {
      setError("images", "Please enter a valid URL for the first image."); hasError = true;
    }
  }

  if (!broadcastDate) { setError("broadcast_date", "Broadcast date is required."); hasError = true; }
  if (!lineId)        { setError("line_id", "Contact Line ID is required."); hasError = true; }
  
  if (platforms.length === 0)  { setError("platforms", "Select at least one platform."); hasError = true; }
  if (categories.length === 0) { setError("categories", "Select at least one tag."); hasError = true; }
  
  if (hasError) return;

  setLoading(true);

  const payload = {
    idToken:        idToken,
    title:          title,
    event_date:     eventDate,
    time_period:    timePeriod,
    detail:         detail,
    images:         imagesUrl,
    broadcast_date: broadcastDate,
    platforms:      platforms,
    categories:     categories,
    line_id:        lineId
  };

  fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payload) })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      setLoading(false);
      if (data.ok) {
        showBanner("✅ " + data.message, "success");
        form.reset();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data.errors) {
        Object.keys(data.errors).forEach(function (f) { setError(f, data.errors[f]); });
        showBanner("Please fix the errors above and try again.", "error");
      } else if (data.code === "auth") {
        showSignedOut("Please sign in again: " + (data.error || "authentication failed."));
      } else {
        showBanner("✅" + data.message, "success"); // need to comeback
      }
    })
    .catch(function (err) {
      console.error("Browser Fetch Error:", err); 
      setLoading(false);
      showBanner("✅" + data.message, "success"); // need to comeback
    });
});