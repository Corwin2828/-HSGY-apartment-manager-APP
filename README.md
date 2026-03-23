# apartment-management-cn

面向中国大陆公寓场景的正式商用管理系统，覆盖集中式/分散式公寓运营，支持房东、管理员、租户、超级管理员四类角色，手机优先、完全响应式，并预留腾讯云全家桶集成能力。

## 技术栈

- Next.js 14 App Router + TypeScript strict
- Tailwind CSS + Ant Design Mobile + ECharts
- Prisma ORM + MySQL 8 + Prisma Accelerate
- JWT + bcrypt + AES-256-GCM
- 腾讯云 COS / 短信 / 电子签
- 微信支付 H5 / 支付宝 H5
- Docker + docker-compose

## 重要说明

- npm 当前没有可安装的 `antd-mobile v6`，本项目临时采用最新稳定版 `antd-mobile 5.42.3`，其余架构与商用基线保持一致。
- 当前仓库已完成商用脚手架、目录规划、中间件、安全层、支付/合同/退押核心 API、Docker 部署文件与 SUPERADMIN 初始化脚本。
- 第三方云服务 SDK 已预留真实接入点；未配置密钥时默认走安全的 mock 流程，方便本地联调。

## 本地开通步骤

1. 复制环境变量文件。

```bash
cp .env.example .env
```

2. 按实际环境填写以下关键配置。

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `JWT_SECRET`
- `AES_SECRET_HEX`
- `SUPERADMIN_PHONE`
- `TENCENT_COS_*`
- `TENCENT_SMS_*`
- `TENCENT_ESIGN_*`
- `WECHATPAY_*`
- `ALIPAY_*`

3. 启动本地 MySQL。

```bash
docker compose up -d mysql
```

4. 执行 Prisma 迁移与客户端生成。

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

5. 创建初始超级管理员。

```bash
SUPERADMIN_INIT_PASSWORD='Admin123456' npm run admin:create-superadmin
```

6. 初始化演示数据。

```bash
npm run prisma:seed
```

7. 启动开发环境。

```bash
npm run dev
```

8. 访问登录页。

```text
http://localhost:3000/login
```

## 本地演示流程

执行以下命令后，可直接体验完整演示数据：

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

### 演示账号

- 超级管理员
  - 手机号：`.env` 中的 `SUPERADMIN_PHONE`
  - 密码：`Super12345`
- 房东
  - 手机号：`13900000001`
  - 密码：`Landlord123`
- 管理员
  - 手机号：`13900000002`
  - 密码：`Admin12345`
- 租户
  - 手机号：`13900000003`
  - 密码：`Tenant123`

### 推荐演示路径

1. 用房东账号登录，查看 `楼栋房间`、`退押管理`、`电子合同`
2. 用管理员账号登录，查看 `抄表计费`、`报修处理`
3. 用租户账号登录，查看 `账单明细`、`在线支付`、`退押申请`
4. 用超级管理员账号直接访问 `/dashboard/super`

### 演示数据内容

- 1 个房东、1 个管理员、1 个租户、1 个超级管理员
- 1 栋楼、1 个在租房间、1 个同住人
- 水费、电费、房租、押金样例账单
- 1 条处理中报修
- 1 条已审批待执行的退押申请
- 1 条待签署合同与 PDF 存档样例

## SUPERADMIN 创建规则

- 超级管理员入口默认隐藏，不在任何菜单、侧边栏、footer 中显示。
- 只有登录手机号命中 `.env` 中的 `SUPERADMIN_PHONE` 时，登录页才会显示隐藏入口按钮。
- 即使不显示按钮，超级管理员也可在登录成功后直接访问 `/dashboard/super`。

## 生产部署建议

### 腾讯云推荐架构

- 计算层：腾讯云 Lighthouse / CVM / TKE
- 数据库：TencentDB for MySQL 8
- 文件存储：腾讯云 COS
- CDN：腾讯云 CDN
- 短信：腾讯云 SMS
- 合同：腾讯电子签
- 支付：微信支付商户平台 + 支付宝开放平台
- 域名与证书：腾讯云 DNSPod + SSL 证书服务

### Docker 部署

1. 准备 `.env`
2. 执行镜像构建与容器启动

```bash
docker compose up -d --build
```

3. 初始化数据库结构

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
```

4. 创建超级管理员

```bash
docker compose exec -e SUPERADMIN_INIT_PASSWORD='Admin123456' app npm run admin:create-superadmin
```

## 目录说明

- `prisma/schema.prisma`: 商用数据模型
- `prisma/seed.ts`: 本地演示数据初始化
- `middleware.ts`: 登录态、角色守卫、限流
- `src/lib/auth`: JWT、密码、Session、鉴权
- `src/lib/crypto`: AES 与图形验证码
- `src/lib/payment`: 微信/支付宝支付与退款
- `src/lib/contract`: 腾讯电子签与合同 PDF
- `src/lib/refund`: 退押申请、审核、确认、执行
- `src/lib/rate-limit`: 内存限流与 Redis REST 兼容适配
- `src/app/api`: 核心业务 API
- `docker-compose.yml`: 本地与单机部署入口
- `docker/app/Dockerfile`: 生产镜像构建
- `docs/OPERATIONS.md`: 运维与上线手册

## 已实现的核心 API

### 支付

- `POST /api/payments/create`
- `GET /api/payments/query`
- `POST /api/payments/callback/wechat`
- `POST /api/payments/callback/alipay`

### 电子合同

- `POST /api/contracts/create`
- `POST /api/contracts/callback/tencent-esign`
- `POST /api/contracts/pdf-sync`
- `GET /api/contracts/detail/:id`

### 退押闭环

- `POST /api/refunds/apply`
- `POST /api/refunds/approve`
- `POST /api/refunds/confirm`
- `POST /api/refunds/execute`
- `GET /api/refunds/detail/:id`
- `POST /api/refunds/callback/wechat`
- `POST /api/refunds/callback/alipay`

### 健康与版本

- `GET /api/health`
- `GET /api/ready`
- `GET /api/version`

## 安全与合规建议

- 身份证信息必须只存 AES 加密后的密文，不得明文入库或输出日志。
- 正式生产环境必须启用 HTTPS，并将 `SESSION_COOKIE_SECURE=true`。
- 建议为登录、短信、图形验证码、支付回调、合同回调增加 Redis 级别限流与幂等控制。
- 建议将操作日志写入独立审计库或日志平台，满足长期追溯需求。
- 如涉及中国大陆正式商用，请按实际经营主体完成《增值电信业务备案》、`ICP 备案`、隐私政策、用户协议和个人信息处理规则公示。

## 质检状态

- `npm run lint` 已通过
- `npm run typecheck` 已通过
- `npm run prisma:seed` 已提供
- `npm run test` 已提供
- `npm run test:coverage` 已提供

## 后续建议

- 接入 Redis 做分布式限流、验证码缓存与支付幂等锁
- 将 mock 支付/短信/电子签替换为真实腾讯云与支付网关实现
- 增加 Playwright E2E、审计日志导出、Excel 批量导入导出
