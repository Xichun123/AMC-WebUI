# AMC WebUI Docker 部署指南

本文只说明 Docker 部署。低内存 VPS 建议直接拉取 GHCR 镜像，不要在服务器上构建。

## 部署方式

项目提供两个容器：

- `web`：Nginx 托管前端，并把 `/api/*` 反向代理到 `api`
- `api`：Node 服务，处理 Gemini 代理、Vertex AI、GCS Files、站点登录和 MCP 路由

本地或高配置机器可以直接构建：

```bash
docker compose up -d --build
```

VPS 推荐拉取已经构建好的 GHCR 镜像：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

默认镜像标签是 `main`。如果要固定到某次构建：

```bash
AMC_WEBUI_IMAGE_TAG=sha-<commit> docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

## 目录结构

推荐服务器目录：

```text
/opt/amc-webui/
├── .env
├── docker-compose.yml
├── docker-compose.ghcr.yml
└── secrets/
    └── sa.json
```

`secrets/sa.json` 只在使用 Vertex AI 时需要。不要提交 `.env` 或 `secrets/`。

## 最小 .env

AI Studio / BYOK 自用模式：

```env
WEB_PORT=127.0.0.1:18080
RUNTIME_USE_CUSTOM_API_CONFIG=true
RUNTIME_USE_API_PROXY=true
RUNTIME_API_PROXY_URL=/api/gemini
RUNTIME_BACKEND_FLAVOR=aistudio
```

这种模式下，用户在网页设置里填写 Gemini API Key。服务端不需要保存 `GEMINI_API_KEY`。

## Vertex AI + GCS

如果要让服务端统一托管 API，不在浏览器暴露 key，使用 Vertex AI：

```env
WEB_PORT=127.0.0.1:18080

GEMINI_BACKEND=vertex
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/sa.json

GCS_BUCKET=your-gcs-bucket
GCS_OBJECT_PREFIX=amc-files/
GCS_MAX_FILE_BYTES=2147483648

RUNTIME_SERVER_MANAGED_API=true
RUNTIME_USE_CUSTOM_API_CONFIG=true
RUNTIME_USE_API_PROXY=true
RUNTIME_API_PROXY_URL=/api/gemini
RUNTIME_BACKEND_FLAVOR=vertex
```

要求：

- `./secrets/sa.json` 是 Google Cloud Service Account JSON
- Service Account 能调用 Vertex AI
- Service Account 对 `GCS_BUCKET` 有对象读写权限
- `GCS_BUCKET` 留空时，Gemini Files/GCS 适配器不会启用

视频和大文件上传走分片上传。前端默认 8MB 分片，后端单个 chunk 上限为 50MB，单文件总大小由 `GCS_MAX_FILE_BYTES` 控制。

## 站点登录

如需给站点加一层登录保护：

```bash
npm run auth:hash -- "your-password"
```

把生成的哈希写入 `.env`：

```env
SITE_AUTH_SECRET=replace-with-a-long-random-secret
SITE_AUTH_SESSION_DAYS=7
SITE_AUTH_USERS_JSON=[{"username":"amc","passwordHash":"scrypt:..."}]
```

说明：

- `SITE_AUTH_USERS_JSON` 为空时不启用登录页
- 不要把明文密码写入 `.env`
- 站点登录只控制访问入口，不做多用户聊天数据隔离

## 反向代理

建议使用 Caddy。示例：

```caddy
amc.example.com {
    encode zstd gzip

    request_body {
        max_size 0
    }

    reverse_proxy 127.0.0.1:18080 {
        flush_interval -1
        transport http {
            response_header_timeout 1h
            dial_timeout 10s
        }
    }
}
```

如果使用其他反向代理，需要确认：

- WebSocket 和 SSE 不被缓冲
- `/api/gemini/*` 允许长连接和流式响应
- 上传请求体大小足够大，或不限制
- 对外只暴露 `web` 端口，不直接暴露 `api` 容器端口

## 更新

VPS 使用 GHCR 镜像更新：

```bash
cd /opt/amc-webui
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml logs --tail=200 api web
```

健康检查：

```bash
curl -I http://127.0.0.1:18080/login
```

如果启用了站点登录，未登录访问 API 返回 `401 {"error":"AUTH_REQUIRED"}` 是正常的。

## 回滚

使用固定镜像标签回滚：

```bash
cd /opt/amc-webui
AMC_WEBUI_IMAGE_TAG=sha-<old-commit> docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
AMC_WEBUI_IMAGE_TAG=sha-<old-commit> docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

确认没问题后，再把 `.env` 中的 `AMC_WEBUI_IMAGE_TAG` 固定为对应值，或继续使用默认 `main`。

## 常见问题

### VPS 内存不够

不要在 VPS 执行 `docker compose up -d --build`。在 GitHub Actions 构建镜像，再在 VPS 拉取 GHCR 镜像。

### 上传文件失败

先看日志：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml logs --tail=200 api web
```

重点检查：

- `GCS_BUCKET` 是否配置
- Service Account 是否有 GCS 对象读写权限
- 反向代理是否限制请求体大小
- 服务器 DNS 是否能访问 `oauth2.googleapis.com`、`storage.googleapis.com`、`www.googleapis.com`

### 修改 .env 后没有生效

重新创建容器：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

`RUNTIME_*` 会在 `web` 容器启动时写入前端运行时配置，因此改这些变量后必须重启 `web`。
