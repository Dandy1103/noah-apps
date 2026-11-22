const REPO = /^noah-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH = /^[a-z0-9]+(?:\/[a-z0-9]+)*$/;
const NAME_LIMIT = 40;
const URL_LIMIT = 300;

export function checkSystems(systems) {
  if (!Array.isArray(systems) || systems.length === 0) return '至少要有一個系統。';
  const repos = new Set();
  for (const system of systems) {
    const message = checkSystem(system, repos);
    if (message) return message;
  }
  return '';
}

export function checkSystem(system, repos = new Set()) {
  if (!system || typeof system !== 'object') return '系統格式不對。';
  const name = text(system.name);
  if (!name || name.length > NAME_LIMIT) return '系統名稱還沒填，或超過 40 個字。';
  if (typeof system.repo !== 'string' || !REPO.test(system.repo)) return '倉庫名稱要用 noah- 開頭。';
  if (repos.has(system.repo)) return '倉庫名稱重複。';
  repos.add(system.repo);
  if (typeof system.url !== 'string' || system.url.length > URL_LIMIT) return '網址太長。';
  if (system.url && !isHttpUrl(system.url)) return '網址要是 http 或 https，而且不能帶帳號密碼。';
  const audience = text(system.audience);
  if (!audience || audience.length > NAME_LIMIT) return '誰看得到還沒填，或超過 40 個字。';
  if (typeof system.online !== 'boolean') return '上線狀態不正確。';
  return '';
}

export function checkNav(groups, repos) {
  if (!Array.isArray(groups)) return '導覽格式不對。';
  const apps = new Set();
  for (const group of groups) {
    if (!group || typeof group !== 'object') return '導覽格式不對。';
    if (group.app == null || group.app === '') return '每個群組都要屬於一個系統。';
    if (typeof group.app !== 'string' || !repos.has(group.app)) return '群組指到不存在的系統。';
    if (apps.has(group.app)) return '同一個系統不能有兩個群組。';
    apps.add(group.app);
    if (!Array.isArray(group.sections) || group.sections.length === 0) return '每個群組至少要有一個分組。';
    const titles = new Set();
    for (const section of group.sections) {
      if (!section || typeof section !== 'object') return '分組格式不對。';
      const title = text(section.title);
      if (!title || title.length > NAME_LIMIT) return '分組名稱還沒填，或超過 40 個字。';
      if (titles.has(title)) return '同一個群組裡的分組名稱重複。';
      titles.add(title);
      if (!Array.isArray(section.links)) return '連結格式不對。';
      const linkLabels = new Set();
      for (const link of section.links) {
        if (!link || typeof link !== 'object') return '連結格式不對。';
        const linkLabel = text(link.label);
        if (!linkLabel || linkLabel.length > NAME_LIMIT) return '連結名稱還沒填，或超過 40 個字。';
        if (linkLabels.has(linkLabel)) return '同一個分組裡的連結名稱重複。';
        linkLabels.add(linkLabel);
        if (!isOptionalRepo(link.app, repos)) return '連結指到不存在的系統。';
        if (typeof link.path !== 'string' || (link.path !== '' && !PATH.test(link.path))) {
          return '路徑只能用小寫、數字和斜線。';
        }
      }
    }
  }
  return '';
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isOptionalRepo(value, repos) {
  if (value == null || value === '') return true;
  return typeof value === 'string' && repos.has(value);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}
