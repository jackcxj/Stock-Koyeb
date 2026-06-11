# A股实时监控驾驶舱

本项目是一个 A 股监控与提醒 MVP：Netlify 前台、Supabase 数据层、Koyeb/FastAPI 后端、AKShare 行情源。系统只做提醒和风险解释，不自动下单，不读取同花顺 App 登录态。

## 本地前台

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

未配置 Supabase 时，前台会使用演示数据，方便先看页面和交互。

## 本地后端

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 验证

```powershell
npm.cmd test
npm.cmd run build
$env:PYTHONPATH="C:\\Users\\Administrator\\Documents\\stock\\backend"; python -m unittest discover backend/tests
```

## 部署轮廓

- 前台：Netlify，配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_BACKEND_URL`。
- 数据：Supabase，执行 `supabase/schema.sql` 后开启 Auth 与 Realtime。
- 后端：Koyeb，部署 `backend/Dockerfile`，配置 Supabase service role、微信推送 webhook 等私密环境变量。

## 正式启用配置

后端正式启用时使用：

```text
DEMO_MODE=false
ENABLE_AUTO_POLL=true
POLL_INTERVAL_SECONDS=60
```

后台只在 A 股交易时段自动轮询行情：周一到周五 `09:30-11:30`、`13:00-15:00`。非交易时段不主动查询行情；`POST /poll/run-once` 仍可手动调试。

Netlify 前台部署后，需要把 `VITE_BACKEND_URL` 设置为 Koyeb 后端 URL，例如：

```text
VITE_BACKEND_URL=https://your-koyeb-service.koyeb.app
```

部署命令：

```powershell
npx.cmd netlify login
npx.cmd netlify deploy --prod
```

Koyeb 可通过 GitHub 连接仓库部署，或安装 Koyeb CLI 后部署本目录。后端入口为 `backend/Dockerfile`，服务端口为 `8000`。
