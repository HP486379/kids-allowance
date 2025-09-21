// ====== GitHub API 設定 ======
const OWNER = "HP486379";       // GitHubユーザー名
const REPO = "kids-allowance";  // リポジトリ名
const FILE_PATH = "data.json";  // 保存先ファイル
const BRANCH = "main";

// ⚠ 個人利用前提。公開時は必ず安全な管理方法に！
const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE";

// ====== UTF-8 をBase64へ（日本語対応） ======
function toBase64Utf8(str){
  return btoa(unescape(encodeURIComponent(str)));
}

// ====== ファイルのSHA取得（存在しない場合は null を返す） ======
async function getFileSha() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (res.status === 404) return null; // 初回未作成
  if (!res.ok) throw new Error(`Failed to fetch file SHA: ${res.status}`);
  const data = await res.json();
  return data.sha || null;
}

// ====== データ保存 ======
async function saveData(newData) {
  const sha = await getFileSha();
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const body = {
    message: (sha ? "update" : "create") + " data.json",
    content: toBase64Utf8(JSON.stringify(newData, null, 2)),
    branch: BRANCH
  };
  if (sha) body.sha = sha; // 既存ファイルのみ必要
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Failed to save data.json: ${res.status}`);
  return await res.json();
}

// ====== データ読み込み ======
async function loadData() {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FILE_PATH}`;
  const res = await fetch(url);
  if (res.status === 404) {
    return { balance: 0, goals: [] }; // 初期値
  }
  if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);
  return await res.json();
}
