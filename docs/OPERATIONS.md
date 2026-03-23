# 运维手册

## 健康检查

- 存活检查：`GET /api/health`
- 就绪检查：`GET /api/ready`
- 版本信息：`GET /api/version`

建议在负载均衡或容器平台中：

- `livenessProbe` 使用 `/api/health`
- `readinessProbe` 使用 `/api/ready`

## 数据库迁移

开发环境：

```bash
npx prisma migrate dev --name <migration_name>
```

生产环境：

```bash
npx prisma migrate deploy
```

## 初始化数据

执行演示数据初始化：

```bash
npm run prisma:seed
```

说明：

- `seed` 采用尽量幂等的写法
- 重复执行不会轻易生成大量重复演示数据

## 测试

运行单元测试：

```bash
npm run test
```

生成覆盖率：

```bash
npm run test:coverage
```

## 限流存储

默认使用内存限流：

```dotenv
RATE_LIMIT_STORE=memory
```

如需切换到 Redis REST 兼容模式：

```dotenv
RATE_LIMIT_STORE=upstash-rest
UPSTASH_REDIS_REST_URL=https://<your-endpoint>
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

说明：

- 当前实现优先适配 REST 风格 Redis 服务
- 若 Redis 不可用，会自动回退到内存限流
- 正式生产建议使用外部 Redis，避免多实例下限流不一致

## 建议的上线前检查

1. 确认 `.env` 中的 JWT、AES、支付、电子签密钥均已替换
2. 确认 `SESSION_COOKIE_SECURE=true`
3. 确认数据库已完成迁移
4. 确认 `/api/ready` 返回成功
5. 确认支付回调、电子签回调域名为生产地址
6. 确认操作日志、导出与敏感字段脱敏策略已审核
