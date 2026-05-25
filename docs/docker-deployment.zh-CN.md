# AMC WebUI Docker 部署指南

## 你需要准备什么

VPS 上需要：

- Docker
- Docker Compose v2，也就是可以执行 `docker compose version`
- 一个部署目录，例如 `/opt/amc-webui`
- 两个 compose 文件：`docker-compose.yml` 和 `docker-compose.ghcr.yml`
- 一个 `.env`
- 如果使用 Vertex AI，还需要 `secrets/sa.json`

不需要：

- 不需要 Node.js
- 不需要 npm
- 不需要 `git clone`
- 不需要在 VPS 上构建镜像

只有在你明确要在服务器本机构建镜像时，才需要 `git clone` 仓库。低内存 VPS 不建议这样做。

## 1. 创建部署目录

在 VPS 上执行：

```bash
sudo mkdir -p /opt/amc-webui/secrets
sudo chown -R "$USER":"$USER" /opt/amc-webui
cd /opt/amc-webui
```

## 2. 放入 compose 文件

VPS 推荐使用仓库里的这两个文件：

- `docker-compose.yml`
- `docker-compose.ghcr.yml`

可以从本地上传到 VPS，也可以在 VPS 上直接下载。

直接下载示例：

```bash
cd /opt/amc-webui

curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/Xichun123/AMC-WebUI/main/docker-compose.yml

curl -fsSL -o docker-compose.ghcr.yml \
  https://raw.githubusercontent.com/Xichun123/AMC-WebUI/main/docker-compose.ghcr.yml
```

如果你已经在本地有仓库，也可以把这两个文件上传到 `/opt/amc-webui/`。VPS 不需要完整仓库。

## 3. 编写 .env

### 3.1 AI Studio / BYOK 模式

如果只是自用，并且希望在网页设置里填写 Gemini API Key，使用这个最小配置：

```env
WEB_PORT=127.0.0.1:18080

RUNTIME_USE_CUSTOM_API_CONFIG=true
RUNTIME_USE_API_PROXY=true
RUNTIME_API_PROXY_URL=/api/gemini
RUNTIME_BACKEND_FLAVOR=aistudio
```

写入文件：

```bash
cd /opt/amc-webui
nano .env
```

这种模式下：

- 服务端不需要 `GEMINI_API_KEY`
- 用户进入网页后，在设置里填写 Gemini API Key
- 普通 Gemini 请求走 `/api/gemini`
- Live API 仍由浏览器直连官方服务

### 3.2 Vertex AI + GCS 模式

如果希望服务端统一使用 Vertex AI，不在浏览器保存 API Key，使用这个配置。

必须修改的值：

- `GCP_PROJECT_ID`
- `GCS_BUCKET`
- `SITE_AUTH_*`，如果你启用站点登录
- `WEB_PORT`，如果你的反向代理不是转发到 `127.0.0.1:18080`

其余值通常可以先保持示例默认值。

```env
WEB_PORT=127.0.0.1:18080 # 宿主机监听地址和端口；Caddy 示例会转发到这个地址，改端口时两边要一致

GEMINI_BACKEND=vertex # 固定为 vertex，表示后端使用 Vertex AI
GCP_PROJECT_ID=your-gcp-project-id # 必须改成你的 Google Cloud 项目 ID
GCP_LOCATION=global # Vertex AI 区域；常用 global 或 us-central1，和你的模型/项目配置保持一致
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/sa.json # 容器内 Service Account JSON 路径；通常保持不变

GCS_BUCKET=your-gcs-bucket # 必须改成你的 GCS Bucket 名称，用于文件/视频上传
GCS_OBJECT_PREFIX=amc-files/ # 写入 GCS 的对象前缀；通常保持默认，也可以改成自己的目录前缀
GCS_MAX_FILE_BYTES=2147483648 # 单文件最大字节数；这里是 2GB，可按需要调小或调大

RUNTIME_SERVER_MANAGED_API=true # 固定为 true，让前端默认使用服务端托管 API
RUNTIME_USE_CUSTOM_API_CONFIG=true # 固定为 true，让前端使用运行时 API 配置
RUNTIME_USE_API_PROXY=true # 固定为 true，让普通 Gemini 请求走后端代理
RUNTIME_API_PROXY_URL=/api/gemini # 固定为 /api/gemini，除非你改了反向代理路径
RUNTIME_BACKEND_FLAVOR=vertex # 固定为 vertex，让前端按 Vertex 后端模式工作
```

然后把 Service Account JSON 放到：

```text
/opt/amc-webui/secrets/sa.json
```

权限建议：

```bash
chmod 600 /opt/amc-webui/.env
chmod 600 /opt/amc-webui/secrets/sa.json
```

Vertex AI + GCS 要求：

- Service Account 能调用 Vertex AI
- Service Account 对 `GCS_BUCKET` 有对象读写权限
- `GCS_BUCKET` 留空时，文件上传的 GCS 适配器不会启用

视频和大文件上传走分片上传。前端默认 8MB 分片，后端单个 chunk 上限为 50MB，单文件总大小由 `GCS_MAX_FILE_BYTES` 控制。

## 4. 可选：启用站点登录

如果站点会暴露到公网，建议启用站点登录。

密码哈希需要在有 Node.js 的机器上生成。可以在本地仓库执行：

```bash
npm run auth:hash -- "your-password"
```

然后把结果写入 VPS 的 `.env`：

```env
SITE_AUTH_SECRET=replace-with-a-long-random-secret
SITE_AUTH_SESSION_DAYS=7
SITE_AUTH_USERS_JSON=[{"username":"amc","passwordHash":"scrypt:..."}]
```

要求：

- `SITE_AUTH_SECRET` 必须是长随机字符串
- `.env` 里保存 `passwordHash`，不要保存明文密码
- `SITE_AUTH_USERS_JSON` 为空时不会启用登录页

站点登录只控制谁能进入网站，不做多用户数据隔离。聊天记录、文件和设置仍属于当前浏览器 Profile。

## 5. 拉取并启动容器

在 VPS 上执行：

```bash
cd /opt/amc-webui

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  pull

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  up -d
```

检查容器：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  ps
```

默认会启动两个服务：

- `web`
- `api`

如果 `.env` 使用 `WEB_PORT=127.0.0.1:18080`，应用只监听 VPS 本机的 `18080`，需要配反向代理对外访问。

## 6. 配置 Caddy 反向代理

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

反向代理必须满足：

- 支持 WebSocket
- 不缓冲 SSE/流式响应
- 不限制，或足够放宽上传请求体大小
- 对外只暴露 `web`，不要直接暴露 `api`

如果域名经过 Cloudflare 代理，要注意 Cloudflare 套餐可能限制单次请求体大小。大视频上传更适合 DNS only，或使用支持大请求体的上层网关。

## 7. 验证部署

检查页面：

```bash
curl -I http://127.0.0.1:18080/login
```

查看日志：

```bash
cd /opt/amc-webui

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  logs --tail=200 api web
```

如果启用了站点登录，未登录访问 API 返回下面内容是正常的：

```json
{ "error": "AUTH_REQUIRED" }
```

## 8. 更新

VPS 更新只拉镜像，不构建：

```bash
cd /opt/amc-webui

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  pull

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  up -d

docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  ps
```

更新后看日志：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.ghcr.yml \
  logs --tail=200 api web
```

## 9. 固定版本和回滚

默认镜像标签是 `main`。如果要固定到某个 commit 对应的镜像，在 `.env` 增加：

```env
AMC_WEBUI_IMAGE_TAG=sha-<commit>
```

然后执行：

```bash
cd /opt/amc-webui
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

回滚也是同样方式，把 `AMC_WEBUI_IMAGE_TAG` 改成旧的 `sha-<commit>` 后重新 `pull` 和 `up -d`。

## 10. 本机构建方式

只有在机器内存和 CPU 足够时才使用本机构建。

这种方式需要完整仓库：

```bash
git clone https://github.com/Xichun123/AMC-WebUI.git
cd AMC-WebUI
cp .env.example .env
```

编辑 `.env` 后启动：

```bash
docker compose up -d --build
```

低内存 VPS 不建议使用这一节。服务器部署优先使用前面的 GHCR 镜像方式。

## 常见问题

### VPS 内存不够

不要在 VPS 执行：

```bash
docker compose up -d --build
```

应该让 GitHub Actions 构建镜像，VPS 只执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

### 不确定是否需要 git clone

VPS 使用 GHCR 镜像部署时，不需要 `git clone`。

需要的只有：

- `docker-compose.yml`
- `docker-compose.ghcr.yml`
- `.env`
- 可选的 `secrets/sa.json`

只有本机构建镜像时才需要 `git clone`。

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

重启容器：

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

`RUNTIME_*` 会在 `web` 容器启动时写入前端运行时配置，因此修改这些变量后必须重启 `web`。
