/**
 * Email/password auth. Passwords are salted + SHA-256 hashed (Apps Script
 * has no bcrypt available), sessions are random opaque tokens stored in the
 * Sessions sheet and sent back by the client on every request — Apps
 * Script Web Apps can't set cross-origin cookies, so a bearer-style token
 * carried in the request body stands in for one.
 */

var SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
var DEFAULT_CATEGORIES = [
  { name: "ทั่วไป", color: "#2563eb" },
  { name: "เอกสารราชการ", color: "#16a34a" },
  { name: "การเงิน", color: "#d97706" },
  { name: "สุขภาพ", color: "#dc2626" },
];

function normalizeEmail_(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function hashPassword_(password, salt) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + ":" + salt,
    Utilities.Charset.UTF_8,
  );
  return digest
    .map(function (b) {
      return ("0" + (b & 0xff).toString(16)).slice(-2);
    })
    .join("");
}

function findUserByEmail_(email) {
  var users = getAllRows_("Users");
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) return users[i];
  }
  return null;
}

function toUserDto_(user) {
  return { id: user.id, email: user.email, name: user.name || null };
}

function createSession_(userId) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var now = Date.now();
  insertRow_("Sessions", {
    token: token,
    userId: userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_DURATION_MS).toISOString(),
  });
  return token;
}

function Auth_validateSession(token) {
  if (!token) return null;
  var session = findById_("Sessions", token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    deleteById_("Sessions", token);
    return null;
  }
  return session.userId;
}

function Auth_register(p) {
  var email = normalizeEmail_(p.email);
  var password = String(p.password || "");
  var name = String(p.name || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("อีเมลไม่ถูกต้อง");
  }
  if (password.length < 8) {
    throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (findUserByEmail_(email)) {
    throw new Error("มีบัญชีที่ใช้อีเมลนี้อยู่แล้ว");
  }

  var userId = Utilities.getUuid();
  var salt = Utilities.getUuid();
  var user = {
    id: userId,
    email: email,
    passwordHash: hashPassword_(password, salt),
    salt: salt,
    name: name,
    createdAt: new Date().toISOString(),
  };
  insertRow_("Users", user);

  DEFAULT_CATEGORIES.forEach(function (c) {
    insertRow_("Categories", {
      id: Utilities.getUuid(),
      userId: userId,
      name: c.name,
      color: c.color,
      createdAt: new Date().toISOString(),
    });
  });

  var token = createSession_(userId);
  return { token: token, user: toUserDto_(user) };
}

function Auth_login(p) {
  var email = normalizeEmail_(p.email);
  var password = String(p.password || "");
  var genericError = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

  var user = findUserByEmail_(email);
  if (!user) throw new Error(genericError);

  var hash = hashPassword_(password, user.salt);
  if (hash !== user.passwordHash) throw new Error(genericError);

  var token = createSession_(user.id);
  return { token: token, user: toUserDto_(user) };
}

function Auth_logout(p) {
  if (p.token) deleteById_("Sessions", p.token);
}

function Auth_me(userId) {
  var user = findById_("Users", userId);
  if (!user) throw new Error("ไม่พบผู้ใช้");
  return { user: toUserDto_(user) };
}
