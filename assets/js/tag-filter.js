// Client-side tag filtering (OR logic)
(() => {
  const posts = Array.from(document.querySelectorAll(".post"));
  const tagPills = document.getElementById("tagPills");
  const emptyState = document.getElementById("emptyState");
  const countMeta = document.getElementById("countMeta");
  const clearBtn = document.getElementById("clearTags");
  const allBtn = document.getElementById("selectAll");
  const searchInput = document.getElementById("searchInput");

let searchQuery = "";


  if (!posts.length || !tagPills || !countMeta) return;

  // Collect all tags from data-tags attributes
  const tags = new Set();
  posts.forEach(p => {
    (p.dataset.tags || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(t => tags.add(t));
  });

  const selected = new Set();

  // Build tag buttons
  [...tags].sort((a,b) => a.localeCompare(b)).forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tagBtn";
    btn.textContent = tag;
    btn.type = "button";

    btn.addEventListener("click", () => {
      if (selected.has(tag)) selected.delete(tag);
      else selected.add(tag);

      btn.classList.toggle("active", selected.has(tag));
      applyFilter();
    });

    const li = document.createElement("li");
    li.appendChild(btn);
    tagPills.appendChild(li);
  });

  function applyFilter(){
    let visible = 0;

    posts.forEach(p => {
      const tags = (p.dataset.tags || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

      const show = selected.size === 0
        ? true
        : tags.some(t => selected.has(t));

      p.style.display = show ? "" : "none";
      if (show) visible++;
    });

    if (emptyState) emptyState.style.display = (visible === 0) ? "" : "none";
    countMeta.textContent = `showing: ${visible} / ${posts.length}`;
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selected.clear();
      document.querySelectorAll(".tagBtn").forEach(b => b.classList.remove("active"));
      applyFilter();
    });
  }

  if (allBtn) {
    allBtn.addEventListener("click", () => {
      selected.clear();
      document.querySelectorAll(".tagBtn").forEach(b => b.classList.remove("active"));
      applyFilter();
    });
  }

  applyFilter();
})();

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = (e.target.value || "").trim().toLowerCase();
    applyFilter();
  });
}
