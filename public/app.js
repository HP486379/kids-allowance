const beforeInput = document.getElementById("before");
const afterInput  = document.getElementById("after");
const compareBtn  = document.getElementById("compareBtn");
const statusEl    = document.getElementById("status");
const resultsEl   = document.getElementById("results");
const pagesEl     = document.getElementById("pages");
const textDiffEl  = document.getElementById("textDiff");

function refreshButton() {
  compareBtn.disabled = !(beforeInput.files?.length && afterInput.files?.length);
}
beforeInput.addEventListener("change", refreshButton);
afterInput.addEventListener("change", refreshButton);

compareBtn.addEventListener("click", async () => {
  const before = beforeInput.files?.[0];
  const after  = afterInput.files?.[0];
  if (!before || !after) return;

  statusEl.textContent = "比較中…（ページ画像生成と差分計算）";
  compareBtn.disabled = true;
  resultsEl.classList.add("hidden");
  pagesEl.innerHTML = "";
  textDiffEl.innerHTML = "";

  try {
    const fd = new FormData();
    fd.append("before", before);
    fd.append("after", after);

    const res = await fetch("/api/compare", {
      method: "POST",
      body: fd
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderResults(data);
    statusEl.textContent = `完了：比較ページ数 ${data.pageCount}`;
  } catch (e) {
    console.error(e);
    statusEl.textContent = `エラー：${e.message}`;
  } finally {
    compareBtn.disabled = false;
  }
});

function renderResults(data) {
  // ページ画像
  data.pages.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header">
        <strong>Page ${p.index}</strong>
        <span class="chip">diffPixels: ${p.diffPixels.toLocaleString()}</span>
      </div>
      <div class="imgs">
        <div><div class="caption">Before</div><img src="${p.before}" alt="before p${p.index}"></div>
        <div><div class="caption">After</div><img src="${p.after}"  alt="after p${p.index}"></div>
        <div><div class="caption">Diff</div><img src="${p.diff}"   alt="diff p${p.index}"></div>
      </div>
    `;
    pagesEl.appendChild(card);
  });

  // テキスト差分
  const frag = document.createDocumentFragment();
  data.textDiff.forEach(part => {
    const span = document.createElement("span");
    let cls = "common";
    if (part.added) cls = "added";
    if (part.removed) cls = "removed";
    span.className = `chunk ${cls}`;
    span.textContent = part.value;
    frag.appendChild(span);
  });
  textDiffEl.appendChild(frag);

  resultsEl.classList.remove("hidden");
}
