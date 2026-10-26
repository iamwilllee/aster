# 账号安全设置

选中 auth 的产品可在 `/app/settings`（中文 `/zh/app/settings`）使用账号安全设置，无需新供应商、绑定或数据库迁移。展示站关闭 auth 时，这些页面和私有 API 一起关闭。沿用 Better Auth、已有 session/account 表、D1 和共享 UI。

## 用户流程

- 已启用 emailPassword，且当前账号确有 credential 密码：输入当前密码、新密码与确认值。新密码要求 12–128 个字符，与当前密码不同；服务端强制撤销旧会话并轮换当前浏览器的 Cookie，因此当前设备可以继续操作。此流程不依赖邮件投递；找回密码仍需所选发信服务。
- 仅 Google 等第三方登录或密码能力未选中：只显示原登录方式说明，不显示改密/找回表单，不提供“顺便设置密码”的入口。
- 登录设备：查看有效会话、当前设备及登录/会话更新时间；确认后撤销一个其他会话或全部其他会话。当前设备使用已有“退出登录”入口。

设备名称只从 UA 推断固定浏览器/平台类别，不识别精确物理设备，不推测地理位置。更新时间来自 Better Auth 的周期性 session 更新，不能当成逐请求最后活动时间或在线指示。最多展示最近 50 个有效会话，当前会话优先；超出时明确提示，批量撤销仍覆盖全部其他会话。

## 接口与安全边界

| 接口                                       | 行为                                                             |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `GET /api/account/security`                | 返回 canChangePassword、hasMore 与白名单会话摘要                 |
| `POST /api/account/password`               | 仅 currentPassword/newPassword；拒绝客户端自行关闭撤销或指定用户 |
| `DELETE /api/account/sessions/:id`         | 按当前 user_id 删除一个其他会话，未知/越权 ID 返回相同 404       |
| `POST /api/account/sessions/revoke-others` | 保留当前会话，删除同一账号的其他会话                             |

服务端使用权威会话检查，要求邮箱已验证，所有写请求检查精确 Origin、请求大小与原子用户限流。改密另限每用户每分钟 5 次尝试；普通私有写操作继续遵守每分钟 30 次限制。设备撤销 SQL 同时检查当前会话仍有效；不接受客户端指定用户归属。

列表只返回 id/current/browser/platform/createdAt/updatedAt/expiresAt，不返回 session token、用户 ID、原始 UA/IP、密码散列或 OAuth 凭据。会话 ID 是非认证凭据，撤销仍须验证所属账户。响应 no-store；改密只转发 Better Auth 的 HttpOnly Set-Cookie，丢弃其原始 token/user JSON。密码不写入查询缓存变量、本地存储或日志。

浏览器原生 `/api/auth/list-sessions`、`revoke-session`、`revoke-sessions`、`revoke-other-sessions`、`change-password`、`set-password` 已关闭，避免暴露令牌列表或绕过强制撤销。不要直接把 Better Auth 的原生会话响应接到客户端。服务端改密复用 Better Auth 内部 API，未重新实现哈希或签名。

修改失败不会展示成功。网络/存储故障可能发生在会话撤销、密码更新或新 Cookie 返回之间；如状态不明，重新登录，必要时按已配置的邮件找回流程处理，不能假定原会话一定保留。当前 D1 适配器不提供跨请求全局事务或并发登录锁。

## Agent 接入与验收

已有产品先按 [升级指南](UPGRADING.md) 扫描。按实际差异合并 security 模块、私有 API 分发、原生路径关闭、限流、设置页组件、词典和测试；保留业务、品牌和原认证配置，不能整份覆盖。新功能不增加一个必须开启的外部服务开关，属于既有 auth 能力；按用户选定登录方式与账号实际凭据显示。

本地验收必须包含错误旧密码、确认不一致、改密后旧密码拒绝、旧 Cookie/其他会话失效而当前新 Cookie 可用、单项及批量撤销、当前会话保护、跨账号拒绝、CSRF/请求大小/限流，以及无密码、auth-disabled、手机/语言/主题和加载/错误恢复。UI fixture 和模拟 OAuth 不算真实 Google 验收；新改动接入实际产品后重置受影响的认证证据，在获准环境重新验证。

执行 `pnpm check`、`pnpm format:check`、`pnpm test:e2e`，运行时/认证变化再执行 `pnpm test:production` 及相应 profile。源码测试通过不等于免费云 CPU 合格、真实邮件或 Google 可用。导出与注销见 [账号生命周期](ACCOUNT-LIFECYCLE.md)；绑定新登录方式及修改邮箱尚未实现。

参考：[Better Auth 密码认证](https://better-auth.com/docs/authentication/email-password)、[会话管理](https://better-auth.com/docs/concepts/session-management)。实现同时核对项目锁定的 Better Auth 1.7.12 源码；升级依赖时重新检查 Cookie 轮换与原生路径行为。
