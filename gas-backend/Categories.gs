var CATEGORY_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4b5563",
];

function categoriesForUser_(userId) {
  return getAllRows_("Categories").filter(function (c) {
    return c.userId === userId;
  });
}

function Categories_findOwned_(userId, categoryId) {
  var category = findById_("Categories", categoryId);
  if (!category || category.userId !== userId) return null;
  return category;
}

function toCategoryDto_(category, documentCount) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    _count: { documents: documentCount },
  };
}

function Categories_list(userId) {
  var categories = categoriesForUser_(userId);
  var documents = documentsForUser_(userId);

  var counts = {};
  documents.forEach(function (d) {
    if (d.categoryId) counts[d.categoryId] = (counts[d.categoryId] || 0) + 1;
  });

  var dtos = categories
    .sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), "th");
    })
    .map(function (c) {
      return toCategoryDto_(c, counts[c.id] || 0);
    });

  var uncategorized = documents.filter(function (d) {
    return !d.categoryId;
  }).length;

  return {
    categories: dtos,
    stats: { total: documents.length, uncategorized: uncategorized },
  };
}

function Categories_create(userId, p) {
  var name = String(p.name || "").trim();
  if (!name) throw new Error("กรุณาระบุชื่อหมวดหมู่");
  var color =
    p.color && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : CATEGORY_PALETTE[0];

  var existing = categoriesForUser_(userId).find(function (c) {
    return c.name === name;
  });
  if (existing) throw new Error("มีหมวดหมู่นี้อยู่แล้ว");

  var category = {
    id: Utilities.getUuid(),
    userId: userId,
    name: name,
    color: color,
    createdAt: new Date().toISOString(),
  };
  insertRow_("Categories", category);
  return { category: toCategoryDto_(category, 0) };
}

function Categories_update(userId, p) {
  var category = Categories_findOwned_(userId, p.id);
  if (!category) throw new Error("ไม่พบหมวดหมู่");

  var patch = {};
  if (p.name !== undefined) {
    var name = String(p.name).trim();
    if (!name) throw new Error("ชื่อหมวดหมู่ไม่ถูกต้อง");
    patch.name = name;
  }
  if (p.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(p.color)) {
    patch.color = p.color;
  }

  var updated = updateById_("Categories", p.id, patch);
  var documents = documentsForUser_(userId).filter(function (d) {
    return d.categoryId === p.id;
  });
  return { category: toCategoryDto_(updated, documents.length) };
}

function Categories_delete(userId, p) {
  var category = Categories_findOwned_(userId, p.id);
  if (!category) throw new Error("ไม่พบหมวดหมู่");

  // Unlink documents rather than deleting them.
  documentsForUser_(userId)
    .filter(function (d) {
      return d.categoryId === p.id;
    })
    .forEach(function (d) {
      updateById_("Documents", d.id, { categoryId: "" });
    });

  deleteById_("Categories", p.id);
  return { ok: true };
}
