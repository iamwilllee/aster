# 支付主体与供应商选型

Aster 面向个人、个体工商户和公司。主体支持是底座的产品目标，不代表每个平台接受所有地区或身份。当前实现 **Stripe 与 Creem 的测试订阅**；Paddle、Lemon Squeezy、Polar 和国内支付尚未实现。所有渠道均未开放真实收费，也未通过本仓库维护者的真实商户沙箱、身份审核或结算验收。

## 先确定收款资格

在当前产品的 PROJECT.md 与决策记录中确定真实经营/居住地、主体类型、已有获批账户、买家地区、产品类别、收费模式和本人可用的结算方式。国籍、居住地、公司注册地分别处理；买家付款方式不等于卖家提现方式。

从上下文可确定的内容直接采用，只询问真正缺失且影响选择的信息。底座维护者的个人身份不能写成所有新项目的固定配置。没有收款需求时保持 billing 关闭。保留用户明确指定或实际已接通的供应商；资格未知不猜测，不静默切换。

| 主体场景             | 选型方向                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| 大陆个人             | 可优先核验 Creem：官方列出中国个人通过 Alipay 结算；仍需完成实际 KYC、产品审核与本人结算账户验证 |
| 大陆个体工商户/公司  | 按国内商户与跨境平台各自的主体、产品类别、结算条件选择；大陆公司不等于 Stripe 支持地区的公司     |
| 香港或海外个人经营者 | 核对真实经营/居住地是否允许个人开户；Stripe 和 MoR 均按当地资格判断                              |
| 香港或海外公司       | 比较符合当地资格的 Stripe 与 MoR，结合已有账户、费用和税务服务选择                               |

注册公司、开户、付费和外部配置遵循实际授权；选型记录不是开通服务的许可。不要求所有产品都注册海外公司，也不使用不真实的地址或主体绕过审核。

## 官方资料与不确定性

以下核验于 2026-10-25，不是账户审批结果；执行入驻前重新核对。

- **Creem**：支持地区含中国；官方结算说明将中国个人列为 Alipay 收款、企业列为银行账户，收款人应与身份核验一致。支持申请不代表具体产品获批或已经到账。[支持地区](https://docs.creem.io/merchant-of-record/supported-countries)、[中国结算](https://docs.creem.io/merchant-of-record/finance/payouts#china)。
- **Stripe**：标准商户开放地区不含中国大陆、香港单列；部分支持地区允许个人/独资经营者。沙箱可测试不代表可正式收款。[开放地区](https://stripe.com/global)、[账号激活](https://docs.stripe.com/get-started/account/set-up)。
- **Paddle**：个人/独资经营者可跳过公司验证，仍有网站与身份审核；中国不在其不支持供应商地区名单中。但这些资料没有充分确认大陆个人的具体开户与结算路径，资格保持待核验，不作为默认推荐。[审核阶段](https://www.paddle.com/help/start/account-verification/what-is-account-verification)、[地区限制](https://www.paddle.com/help/legal/sanctions/which-countries-are-supported-by-paddle)。
- **Lemon Squeezy**：需身份验证及店铺激活；结算可能经银行或已验证 PayPal。大陆不在其银行结算名单中，PayPal 路径仍需核对本人账户与提现条件。[身份验证](https://docs.lemonsqueezy.com/help/getting-started/verify-your-identity)、[结算](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)、[支持地区](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)。
- **Polar**：卖家结算使用 Stripe Connect Express，公开结算名单目前不含中国大陆。接受全球买家付款不代表大陆个人可收到结算。[结算地区](https://polar.sh/docs/merchant-of-record/supported-countries)。
- **国内支付**：主体和经营类目按渠道核验。尚未实现商户接口，不用个人收款码模拟自动回调或到账验收。

## 配置与 Agent 接入顺序

1. 读取实际产品、既有商户与需求，确定资格和测试范围。在 `starter.project.json` 记录 `payment-provider` 决策，resolved value 使用 `stripe` 或 `creem`，另记录选择依据和资格待核验项。不要记录证件、密钥或银行卡内容。
2. 选用 `billing-test` 能力组合（依赖 auth/database），或在已有产品增量启用 billing。该组合同时支持两种测试渠道，**不是真实收款开关**。初始化器会将已解决的 `payment-provider` 写入本地、staging、production 的 `BILLING_PROVIDER`；未指定时保留兼容默认 Stripe，不代表资格获批。之后的决策修改不会自动改运行配置，Agent 需同步审阅。
3. 每环境显式设置 `BILLING_PROVIDER=stripe|creem`。配置下表当前渠道的测试密钥与商品；本地 `.dev.vars` 不上传，远端使用 secret。`BILLING_ENABLED=false` 默认关闭新结账；核实配置后才在授权的测试环境开启。
4. 在授权范围内完成代码、配置与真实沙箱验收，不停在给用户操作清单。缺少登录、KYC、密钥或平台激活时记录准确阻塞，继续独立工作。没有部署授权时不得为测试擅自部署。
5. 记录实际测试证据，正式部署检查按当前渠道要求 `billing-test-live`（Stripe）或 `billing-creem-test-live`（Creem）：kind=business、scope=provider、verification=real、status=passed，附当前证据路径。模拟签名/HTTP 夹具不能填 real。一种渠道的证据不能替另一种渠道通过。

| 渠道   | 必需秘密配置                                                                      | 回调地址                      | 当前边界                                                                         |
| ------ | --------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| Stripe | STRIPE_SECRET_KEY（sk_test_）、STRIPE_WEBHOOK_SECRET、STRIPE_PRICE_ID             | `/api/billing/webhook/stripe` | 原 `/api/billing/webhook` 继续可用；live key 拒绝                                |
| Creem  | CREEM_API_KEY（测试后台）、CREEM_WEBHOOK_SECRET、CREEM_PRODUCT_ID（测试订阅商品） | `/api/billing/webhook/creem`  | 固定 `https://test-api.creem.io`，仅接受 test/sandbox mode；没有生产地址配置入口 |

Creem 使用托管结账与客户门户；商品价格在供应商测试后台配置，客户端不传商品、金额、客户或 userId。页面回跳（包括 checkout_id）只轮询当前用户的本地状态，不授予权益。原始 HMAC 验签后重新读取供应商结账/订阅，校验已预留的归属、客户、商品及模式，再用 D1 修订号写入并去重。非所选商品不授予当前套餐；平台异常或无法验证的数据关闭操作，不自动换渠道。

## 升级、切换与注销

- 采用本版需审阅并应用新增 `0004_married_boom_boom.sql`；它为订阅、结账和两张归档表增加 provider，旧记录默认 stripe，不改旧迁移。新建产品按顺序应用全部迁移；已有云库按 [数据库发布流程](DATABASE.md) 授权迁移，不能上传本地测试库。
- 切换 `BILLING_PROVIDER` 仅选择新的结账渠道；旧订阅仍计算权益，旧门户和签名回调继续按原渠道处理。保留旧商品 ID、密钥和回调。在 `BILLING_LEGACY_PROVIDERS=stripe`（或 creem，逗号分隔）列出仍有义务的旧渠道，部署检查同时要求其秘密配置；不能靠默认空列表证明没有旧义务。不同渠道未结束账务会阻止新渠道结账。
- provider 字段与 Creem 的 `creem:` ID/事件命名空间隔离历史，避免相同供应商 ID 串账。关新结账不能关旧门户/回调。不要禁用整个 billing 来处理存量订阅。
- [注销核对](ACCOUNT-LIFECYCLE.md) 汇总两种渠道。Stripe 可明确确认关闭本产品已核实的开放链接；Creem 没有已核实的关闭结账接口，不能显示同样的自动操作。应到供应商处理或等待实际失效，再重新核对。
- Creem 读取已知结账/订阅，并有界扫描商店订阅与关联客户交易；只对可验证的完整结果放行。列表截断、未知 pending 预留、超时、欠款或未结束订阅保持阻塞。扫描不是跨平台全局锁，供应商外部后台变更仍需运维处理。

## 验收与后续边界

本地测试涵盖模拟 API、真实 HMAC、D1 归属/幂等/并发、双渠道旧记录、账户归档和页面交互。它们不代表真实供应商接受了请求。产品仍需逐一验证测试后台创建商品、真实托管结账、签名回调、试用/取消/失败重试、门户、账号隔离和注销阻塞；记录测试渠道与测试商品，禁用真实收费。

分别记录：代码实现、本地/模拟测试、真实沙箱、身份/产品审核、结算资格、正式开通和实际结算。当前两种适配均 **TEST ONLY**；正式收费、退款/争议自动处理、一次性购买、完整订单账本和税务/合规发布未开放。不能只换生产密钥宣布上线。首笔实际结算未发生时标待验收，不虚构交易或制造自购；MoR 的间接税服务也不等于个人收入相关义务全部处理。

实现依据：[Creem API 索引](https://docs.creem.io/llms.txt)、[创建结账](https://docs.creem.io/api-reference/endpoint/create-checkout)、[Webhook](https://docs.creem.io/code/webhooks)、[客户门户](https://docs.creem.io/features/customer-portal)。
