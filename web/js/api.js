/**
 * Thin client for the Google Apps Script backend. Every call is a POST
 * with a text/plain body (not application/json) so the browser sends it
 * as a CORS "simple request" — Apps Script Web Apps cannot answer a CORS
 * preflight (OPTIONS) request, so anything that would trigger one fails.
 */

const TOKEN_KEY = "docvault_token";
const USER_KEY = "docvault_user";

const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const Api = {
  async call(action, payload) {
    if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
      throw new Error(
        "ยังไม่ได้ตั้งค่า API_URL — แก้ไขไฟล์ web/js/config.js ก่อน (ดู gas-backend/SETUP.md)",
      );
    }

    const body = JSON.stringify(
      Object.assign({ action, token: Auth.getToken() }, payload || {}),
    );

    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
    } catch {
      throw new Error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }

    const json = await res.json().catch(() => null);
    if (!json) throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง");
    if (!json.ok) {
      if (json.error === "UNAUTHORIZED") {
        Auth.clear();
        showAuthView();
      }
      throw new Error(json.error || "เกิดข้อผิดพลาด");
    }
    return json.data;
  },
};
