# Noah Apps

登記諾亞數智的各個系統：名稱、網址、誰看得到、有沒有上線。

員工進公司還是走 Noah Portal。這個專案是維護那份系統清單。

## 開發

先在 `noah-core` 執行 `mvn` 啟動 API。應用管理前端需要 Node.js 20。

```bash
npm install
npm start
```

畫面在 http://localhost:4200/apps/。本機的 http://127.0.0.1:3002 由 Core 提供，沿用原有 API 路徑。導覽和系統清單存在 PostgreSQL 的 `apps` schema。

登入沿用公告的 Keycloak 回呼。只有 HRM 的在職 `admin` 可以進入應用管理及儲存設定，各系統的導覽列可照常讀取目錄。

部署時，在 `noah-apps` 設定 `CORE_URL` 指向 Core 的私有網址。

## 開下一個系統

在這個資料夾執行。第一個是倉庫名稱，第二個是畫面上的名稱。

```bash
scripts\new-app.cmd noah-notice 公告
```

它會在旁邊建立資料夾、裝好同一套畫面、建立公開的 GitHub 倉庫，並推上 `main` 和 `develop`。port 會接在目前最後一個後面。

系統清單需由管理員登入應用管理後新增。

只要本機資料夾、先不要倉庫：

```bash
node scripts/new-app.mjs noah-notice 公告 --local
```

## 分支

`main` 是穩定版，`develop` 是開發分支。
