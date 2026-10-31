# GitHub Pages 自动部署实现指南

这份文档说明**这套「打 tag 就自动部署」的方案是怎么搭起来的**。
照着从头做一遍，就能在任意一个新仓库上复现同样的能力。

日常怎么提交、怎么发版本，看 [RELEASE.md](./RELEASE.md)。

---

## 零、这套方案做了什么

```text
你本地                          GitHub 云端
--------                        -----------------------------------------
git tag v1.0.0      ──推送──▶   1. 触发 workflow（仅 v* 标签会触发）
git push origin v1.0.0          2. 装依赖 → 类型检查 → 构建（带 base 前缀）
                                3. 复制 404.html（SPA 路由回退）
                                4. 产物打包上传为 artifact
                                5. 发布到 GitHub Pages
                                6. 线上生效：https://<用户名>.github.io/<仓库名>/
```

核心就一句话：**把「构建 + 发布」这两件事写成一份 YAML，交给 GitHub 免费执行，用 tag 作为发布开关。**

关键设计：往 `master` 推代码**不会**部署，只有打 tag 才部署。这样日常提交随便推，发布时机由你控制。

---

## 一、原理拆解：五个部件

| 部件     | 配置项                                        | 作用                               |
| -------- | --------------------------------------------- | ---------------------------------- |
| ① 触发器 | `on.push.tags: ['v*']`                        | 只有 `v` 开头的标签推送才启动      |
| ② 权限   | `permissions: pages: write / id-token: write` | 允许写 Pages、允许用 OIDC 免密登录 |
| ③ 构建   | `pnpm build-only --base=/<仓库名>/`           | 产出带正确路径前缀的静态文件       |
| ④ 产物   | `upload-pages-artifact`                       | 把 `dist` 打包，交给部署阶段       |
| ⑤ 发布   | `deploy-pages`                                | 把产物发布到 Pages 站点            |

为什么拆成 `build` 和 `deploy` 两个 job：

- `build` 只管产出，不需要特殊权限；
- `deploy` 单独一个 job 并挂到 `github-pages` 环境，可以在 Environments 页面看到部署历史、访问地址，还能加人工审批等保护规则。

---

## 二、前置条件清单

开始之前确认这些（本仓库的实际情况已填好）：

- [ ] 代码托管在 GitHub
- [ ] 仓库名：`vite-git`（决定 base 路径）
- [ ] 默认分支：`master`
- [ ] 包管理器：pnpm 10（决定 CI 里用哪个 setup action 和缓存方式）
- [ ] 运行时：Node 24（`package.json` 的 `engines` 要求 `^22.18.0 || >=24.12.0`）
- [ ] 构建产物目录：`dist`
- [ ] 是 SPA 且用了 history 路由 → 需要 404 回退

---

## 三、从零实现：八个步骤

### 步骤 1：确定 base 路径

GitHub Pages 的项目站点地址是 `https://<用户名>.github.io/<仓库名>/`，
所以静态资源的引用路径必须带 `/<仓库名>/` 前缀，否则浏览器会去请求站点根目录下的资源，全部 404、页面白屏。

本仓库的 base 就是 **`/vite-git/`**。

> 这个前缀**只在 CI 构建时通过命令行传入**，不写进 `vite.config.ts`。
> 写进配置文件会让本地开发的访问路径也变成 `http://localhost:5173/vite-git/`，很难受。

路由代码不需要改，只要路由用的是 `import.meta.env.BASE_URL`：

```ts
// src/router/index.ts
history: createWebHistory(import.meta.env.BASE_URL)
```

### 步骤 2：创建工作流文件

新建 `.github/workflows/deploy.yml`，内容见 [第四节完整文件](#四完整工作流文件复制即用)。

注意：`.github` 目录必须在仓库**根目录**，文件名任意，但必须是 `.yml`。

### 步骤 3：在 GitHub 网页端开启 Pages

1. 仓库 → **Settings** → **Pages** → **Build and deployment**
2. **Source** 选 **GitHub Actions**（默认是 `Deploy from a branch`，必须改）→ **Save**

这一步没做，运行会报 `Get Pages site failed` / `Pages site not enabled`。

3. **Settings** → **Actions** → **General** → **Workflow permissions** → 选 **Read and write permissions** → **Save**

这一步没做，`GITHUB_TOKEN` 权限不够，运行会报 `Resource not accessible by integration`。

### 步骤 4：配置 `github-pages` 环境的部署规则（最容易出错）

Pages 开启后 GitHub 会自动创建名为 `github-pages` 的 Environment，它**默认只允许默认分支部署**，所以 tag 会被拦下。

1. **Settings** → **Environments** → 点 `github-pages`
2. **Deployment branches and tags** 选 **Selected branches and tags**
3. 在 **Deployment tags** 那一栏添加规则 `v*`（⚠️ 是 Tags 栏，不是 Branches 栏）
4. 确认显示变成 **`Currently applies to 1 tag`** —— 如果显示 `applies to 0 branches`，说明加成分支规则了，点 Edit 把类型改成 Tag
5. **Save protection rules**
6. 顺带检查同一页的 **Required reviewers**、**Wait timer**：开着的话也会拦截，不需要就清掉

### 步骤 5：处理 SPA 路由的 404 回退

GitHub Pages 是纯静态托管，访问 `/about` 时磁盘上没有这个文件，会返回 404，SPA 根本没机会启动。
Pages 的规则是「找不到就返回 `404.html`」，所以在构建后把 `index.html` 复制一份：

```yaml
- name: SPA fallback
  run: cp dist/index.html dist/404.html
```

这样未知路径会返回应用外壳，再由 Vue Router 接管渲染。

> 代价：不存在的路径也返回 200 和首页内容。要严谨就再加一个 catch-all 路由渲染 NotFound 页面。

### 步骤 6（可选）：加一个打 tag 的脚本

创建 `scripts/release.mjs`，读取 `package.json` 的 `version` 自动打 tag，避免手输版本号写错。
在 `package.json` 加一行：

```json
"release": "node scripts/release.mjs"
```

之后发布只要改 `version` 再执行 `pnpm release`。

### 步骤 7：提交并推送工作流文件

⚠️ **顺序不能反：必须先提交 workflow，再打 tag。**
tag 触发时 GitHub 读取的是该 tag 指向的那次提交里的 `.github/workflows`，那次提交里没有工作流文件的话，什么都不会发生。

```powershell
git add .github/workflows/deploy.yml
git commit -m "ci: 添加 tag 触发的 GitHub Pages 部署"
git push origin master
```

### 步骤 8：打 tag 触发并验证

```powershell
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

验证三件事：

1. **Actions** 页面出现 `Deploy to GitHub Pages` 运行记录，最终全绿；
2. 仓库首页右侧 **Environments** → `github-pages` 显示访问地址；
3. 浏览器打开 `https://zq0726.github.io/vite-git/`，并**直接刷新 `/about` 页面**确认不报 404。

> 调试阶段不想反复打 tag：用 **Actions** → `Deploy to GitHub Pages` → **Run workflow** 手动触发，效果完全一样。

---

## 四、完整工作流文件（复制即用）

```yaml
name: Deploy to GitHub Pages

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch: # 允许在 Actions 页面手动触发，方便调试

permissions:
  contents: read # 拉取代码
  pages: write # 发布 Pages
  id-token: write # OIDC 免密鉴权，不用配置任何 token

concurrency:
  group: pages # 同时只允许一个部署，避免互相覆盖
  cancel-in-progress: false # 部署中不被打断，防止产物传一半

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 10

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Build
        run: pnpm build-only --base=/vite-git/ # ← 换成你的仓库名

      # GitHub Pages 不会把未知路径回退到 index.html，SPA 的 history 路由需要 404.html
      - name: SPA fallback
        run: cp dist/index.html dist/404.html

      - name: Configure Pages
        uses: actions/configure-pages@v6
        with:
          # 仓库尚未启用 Pages 时自动创建站点；权限不足时会失败，建议先手动开启
          enablement: true

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

---

## 五、换仓库 / 新项目时改哪些地方

| 位置                               | 本仓库的值        | 需要改成                                           |
| ---------------------------------- | ----------------- | -------------------------------------------------- |
| `run: pnpm build-only --base=...`  | `/vite-git/`      | `/新仓库名/`                                       |
| `pnpm/action-setup` 的 `version`   | `10`              | 你的 pnpm 大版本                                   |
| `setup-node` 的 `node-version`     | `24`              | 满足 `engines` 的版本                              |
| `cache: pnpm`                      | pnpm              | npm / yarn 要同步改安装命令                        |
| `path: dist`                       | `dist`            | 你的构建产物目录（VitePress 是 `.vitepress/dist`） |
| `cp dist/index.html dist/404.html` | dist              | 同上                                               |
| 构建命令                           | `pnpm build-only` | 你的构建脚本名                                     |
| 默认分支                           | `master`          | 推送命令里的分支名                                 |

非 Vite 项目（VitePress、Nuxt 静态导出等）也一样，只是构建命令和产物目录不同，其余逻辑完全通用。

---

## 六、我们踩过的坑（按顺序）

| 顺序 | 报错                                                                        | 真正原因                                                | 解法                                                                                      |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | `Get Pages site failed` / `Not Found`                                       | 仓库根本没开启 Pages                                    | Settings → Pages → Source 选 GitHub Actions                                               |
| 2    | `Resource not accessible by integration`（create Pages site）               | `GITHUB_TOKEN` 权限不足                                 | Settings → Actions → General → Workflow permissions 改 Read and write                     |
| 3    | `Tag "v1.0.0" is not allowed to deploy due to environment protection rules` | `github-pages` 环境不允许 tag 部署                      | Environments → github-pages → 加 Tag 规则                                                 |
| 4    | 规则加了还是被拒                                                            | `v*` 加成了**分支规则**（显示 `applies to 0 branches`） | 把规则类型改成 **Tag**，直到显示 `applies to 1 tag`                                       |
| 5    | 改完重跑仍是旧行为                                                          | 用了 **Re-run**，它沿用那次运行时的旧工作流文件         | 推送代码后用 **Run workflow** 手动触发；环境规则改动实时生效，不受此影响                  |
| 6    | `Node.js 20 is deprecated` 警告                                             | Action 运行时是 Node 20                                 | 升到最新主版本（checkout v7、setup-node v6、pnpm/action-setup v6、Pages 三件套 v6/v5/v5） |

---

## 七、为什么用官方 Actions 而不是推 gh-pages 分支

另一种常见做法是 `peaceiris/actions-gh-pages` 把 `dist` 推到 `gh-pages` 分支。这里选了官方三件套：

| 对比项   | 推 gh-pages 分支                     | 官方 deploy-pages                      |
| -------- | ------------------------------------ | -------------------------------------- |
| 凭证     | 需要写分支权限的 token               | OIDC 临时换取，零配置                  |
| 仓库     | 多一个长期存在的分支，历史越来越臃肿 | 产物走 artifact，不进 git 历史         |
| 可观测性 | 只能看 workflow 成败                 | Environments 有部署历史、URL、可加审批 |
| 并发     | 可能互相覆盖                         | 内置排队控制                           |

代价就一个：必须先去 Settings 里把 Pages 来源设成 GitHub Actions。
