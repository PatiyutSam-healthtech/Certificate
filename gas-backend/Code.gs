/**
 * DocVault — Google Apps Script backend.
 *
 * This is the single HTTP entry point for the web app. It is deployed as a
 * Web App (Deploy > New deployment > Web app) and called from the static
 * frontend in /web via fetch(). See SETUP.md for deployment steps.
 *
 * Request contract: every call is a POST with a text/plain body containing
 * JSON, e.g. { "action": "documents.list", "token": "...", "q": "..." }.
 * text/plain is used (instead of application/json) specifically so the
 * browser treats it as a "simple request" and skips the CORS preflight —
 * Apps Script Web Apps cannot answer an OPTIONS preflight, so a JSON
 * Content-Type from a cross-origin page would otherwise fail outright.
 * doGet is wired to the same router so the deployed /exec URL can also be
 * opened directly for a quick health check.
 */

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  var params = parseParams_(e);
  var action = params.action;
  try {
    if (!action) throw new Error("missing action");
    var data = route_(action, params);
    return jsonOutput_({ ok: true, data: data });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String((err && err.message) || err) });
  }
}

function parseParams_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (parseErr) {
      // fall through to query-string params below
    }
  }
  return (e && e.parameter) || {};
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function route_(action, p) {
  switch (action) {
    case "register":
      return Auth_register(p);
    case "login":
      return Auth_login(p);
    case "logout":
      Auth_logout(p);
      return { ok: true };
    case "me":
      return Auth_me(requireAuth_(p));

    case "categories.list":
      return Categories_list(requireAuth_(p));
    case "categories.create":
      return Categories_create(requireAuth_(p), p);
    case "categories.update":
      return Categories_update(requireAuth_(p), p);
    case "categories.delete":
      return Categories_delete(requireAuth_(p), p);

    case "documents.list":
      return Documents_list(requireAuth_(p), p);
    case "documents.upload":
      return Documents_upload(requireAuth_(p), p);
    case "documents.update":
      return Documents_update(requireAuth_(p), p);
    case "documents.delete":
      return Documents_delete(requireAuth_(p), p);
    case "documents.download":
      return Documents_download(requireAuth_(p), p);

    default:
      throw new Error("Unknown action: " + action);
  }
}

function requireAuth_(p) {
  var userId = Auth_validateSession(p.token);
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}
