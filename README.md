# Noah Apps

登記諾亞數智的各個系統：名稱、網址、誰看得到、有沒有上線。

員工進公司還是走 Noah Portal。這個專案是維護那份系統清單。

## 開發

需要 Node.js 20。

```bash
npm install
npm run start:api
npm start
```

API 在 http://127.0.0.1:3002 ，畫面在 http://localhost:4202/ 。導覽和系統清單存在 PostgreSQL 的 `apps` schema，跟 HRM 的資料表分開。本機會沿用入口那份資料庫；要指定別台時，在 `.env.local` 填 `DATABASE_URL`。

## 開下一個系統

在這個資料夾執行。第一個是倉庫名稱，第二個是畫面上的名稱。

```bash
scripts\new-app.cmd noah-notice 公告
```

它會在旁邊建立資料夾、裝好同一套畫面、建立公開的 GitHub 倉庫，並推上 `main` 和 `develop`。port 會接在目前最後一個後面。

只要本機資料夾、先不要倉庫：

```bash
node scripts/new-app.mjs noah-notice 公告 --local
```

## 分支

`main` 是穩定版，`develop` 是開發分支。
