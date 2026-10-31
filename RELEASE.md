# 提交与发布指南

本项目使用 GitHub Actions 实现：**打 tag → 自动构建 → 自动部署到 GitHub Pages**。

线上地址：<https://zq0726.github.io/vite-git/>

> 这份是**日常操作手册**（怎么提交、怎么发版）。
> 想了解这套部署方案是怎么搭的、或要在新仓库上复现，看 [DEPLOY.md](./DEPLOY.md)。

---

## 一、总体流程

```text
本地开发 → 提交代码到 master → 修改版本号 → 打 tag 并推送 → GitHub Actions 自动部署 → 线上更新
```

- 往 `master` 提交代码 **不会**触发部署；
- 只有推送 `v` 开头的标签（如 `v1.0.0`）才会触发部署。

---

## 二、一次性准备（只需做一次）

1. 打开 GitHub 仓库 → **Settings** → **Pages** → **Build and deployment**；
2. **Source** 选择 **GitHub Actions**（默认是 `Deploy from a branch`，不改会导致部署失败）并保存；
3. 打开 **Settings** → **Actions** → **General**，找到 **Workflow permissions**，
   选择 **Read and write permissions** 并保存（`GITHUB_TOKEN` 需要写权限才能创建和发布 Pages 站点）；
4. 打开 **Settings** → **Environments** → `github-pages`，把 **Deployment branches and tags** 改成
   **Selected branches and tags** 并添加一条 `v*` 的标签规则（想省事就选 **All branches and tags**）。

   > Pages 环境默认只允许默认分支部署，不配这条，tag 部署会被环境规则直接拦下。

5. 确认 `.github/workflows/deploy.yml` 已经提交到仓库。

> 工作流里的 `configure-pages` 设了 `enablement: true`，理论上能自动创建 Pages 站点。
> 但创建站点这个 API 对 `GITHUB_TOKEN` 有额外权限要求，常报
> `Resource not accessible by integration`，所以**请手动完成第 2、3 步**，不要依赖自动启用。

> 注意顺序：必须**先提交工作流文件，再打 tag**。
> tag 触发时，GitHub 读取的是该 tag 指向的那次提交里的 `.github/workflows`，
> 如果那次提交还没有工作流文件，什么都不会发生。

---

## 三、日常提交代码

### 1. 提交信息规范

仓库配置了 `commitlint`（`@commitlint/config-conventional`），提交信息必须符合约定式格式：

```text
<类型>(可选作用域): <描述>
```

常用类型：

| 类型       | 说明                   | 示例                          |
| ---------- | ---------------------- | ----------------------------- |
| `feat`     | 新功能                 | `feat: 新增用户登录页`        |
| `fix`      | 修复 bug               | `fix(router): 修复刷新后 404` |
| `docs`     | 仅文档改动             | `docs: 补充发布说明`          |
| `style`    | 代码格式（不影响功能） | `style: 统一引号`             |
| `refactor` | 重构                   | `refactor: 拆分用户 store`    |
| `perf`     | 性能优化               | `perf: 首页图片懒加载`        |
| `test`     | 测试相关               | `test: 补充计数器单测`        |
| `chore`    | 构建/依赖/配置等杂项   | `chore: 升级 vite 到 8.2`     |
| `ci`       | CI 配置                | `ci: 添加 Pages 部署工作流`   |

不符合规范会被 `commit-msg` 钩子拒绝（例如写成 `更新代码` 会失败）。

### 2. 提交前会自动做什么

`.husky/pre-commit` 会在提交前执行 `pnpm lint-staged`，对暂存文件做 `eslint --fix` 和 `prettier --write`。
所以你提交上去的代码是统一格式化过的，不需要手动跑格式化。

### 3. 常用命令

```powershell
# 查看改动
git status

# 暂存
git add .

# 提交（信息必须符合上面的规范）
git commit -m "feat: 新增关于页"

# 推送到远程
git push origin master
```

---

## 四、发布上线（打 tag）

### 方式一：使用 release 脚本（推荐）

1. 修改 `package.json` 里的 `version`，例如 `0.1.0`：

   ```json
   {
     "name": "vite-git",
     "version": "0.1.0"
   }
   ```

2. 提交这次版本改动：

   ```powershell
   git add package.json
   git commit -m "chore: release v0.1.0"
   git push origin master
   ```

3. 打 tag 并推送（脚本会读取 `version`，自动生成 `v0.1.0` 标签）：

   ```powershell
   pnpm release
   ```

   等价于执行了：

   ```powershell
   git tag -a v0.1.0 -m "v0.1.0"
   git push origin v0.1.0
   ```

### 方式二：手动打 tag

```powershell
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

> 不要用 `git push --tags`，它会把本地所有标签一次性推上去，可能触发意料之外的部署。

### 版本号怎么定

遵循语义化版本 `主版本.次版本.修订号`：

- 修订号 `0.0.x`：修 bug、小改动；
- 次版本 `0.x.0`：新增功能，向后兼容；
- 主版本 `x.0.0`：不兼容的变更。

### 查看部署进度

推送 tag 后打开仓库的 **Actions** 页面，能看到 `Deploy to GitHub Pages` 正在运行；
完成后左侧 **Environments** 里 `github-pages` 会显示访问地址。

### 出问题怎么回滚

```powershell
# 查看历史标签
git tag

# 删掉有问题的标签
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# 回到上一个版本重新部署（假设上一个版本是 v0.0.1）
git tag -a v0.0.2 -m "rollback to v0.0.1"
git push origin v0.0.2
```

更简单的做法：在 Actions 页面对上一次成功的 `deploy` job 点 **Re-run**。

---

## 五、两个容易被误解的配置

### 1. `--base=/vite-git/` 写在什么地方？

**不在 `vite.config.ts` 里**，它是构建时通过命令行传进去的，位置在：

```42:43:d:/study/vue/vite-git/.github/workflows/deploy.yml
      - name: Build
        run: pnpm build-only --base=/vite-git/
```

为什么不放进 `vite.config.ts`：

- `vite.config.ts` 里的 `base` 对**本地开发和线上构建同时生效**，
  写死 `/vite-git/` 后，本地 `pnpm dev` 的访问路径会变成 `http://localhost:5173/vite-git/`，很别扭；
- 而 GitHub Pages 的项目站点根目录是 `https://<用户名>.github.io/<仓库名>/`，
  产物的资源引用必须是 `/vite-git/assets/xxx.js`，否则会 404 白屏。

所以采取「本地用默认 `/`，只在 CI 构建时传 `/vite-git/`」的方案。

验证方式（本地跑一次，看 `dist/index.html` 里的路径）：

```powershell
pnpm build-only --base=/vite-git/
```

如果你以后**改了仓库名**，必须同步修改这一行，否则线上白屏。

另外，路由那边不需要改任何代码，因为 `src/router/index.ts` 已经用 `import.meta.env.BASE_URL` 读取了 base：

```ts
history: createWebHistory(import.meta.env.BASE_URL)
```

### 2. 404 页面是怎么加的？

**`src` 里并没有 404 页面代码**，它是在 CI 构建完成后，用一条复制命令生成的：

```45:47:d:/study/vue/vite-git/.github/workflows/deploy.yml
      # GitHub Pages 不会把未知路径回退到 index.html，SPA 的 history 路由需要 404.html
      - name: SPA fallback
        run: cp dist/index.html dist/404.html
```

原因：

- 项目用的是 history 模式路由（`createWebHistory`），访问 `/about` 时浏览器会真的向服务器请求 `/about`；
- GitHub Pages 是纯静态托管，磁盘上没有 `about` 这个文件，于是返回 404，SPA 根本没机会加载；
- Pages 的行为是：找不到路径时会去找 `404.html` 并返回它；
- 所以把构建出的 `index.html` 复制成 `404.html`，未知路径就会返回应用外壳，再由 Vue Router 接管渲染 `/about`。

代价是「不存在的路径也返回 200 和首页内容」。想更严谨可以加一个真正的 NotFound 路由：

```ts
// src/router/index.ts
{
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('../views/NotFoundView.vue'),
}
```

这样就需要在 `src/views/` 下新建 `NotFoundView.vue`，算是一个可选增强。

---

## 六、常见问题排查

| 现象                                                                              | 原因与解决办法                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 推了 tag 但 Actions 没反应                                                        | 工作流文件不在该 tag 指向的提交里；或 tag 不是 `v` 开头（如 `1.0.0` 不会触发）                                                                                                                                                    |
| 部署报 `Get Pages site failed` 或 `Pages site not enabled`                        | 仓库的 Pages 功能还没启用。打开 Settings → Pages 把 Source 改成 **GitHub Actions**；工作流已设置 `enablement: true`，通常会自动创建站点，仍失败就手动开启一次                                                                     |
| 报 `Resource not accessible by integration` 且提示 `create-a-apiname-pages-site`  | `GITHUB_TOKEN` 没有创建 Pages 站点的权限。先做第二节的第 2、3 步（手动启用 Pages + 工作流权限改为读写）；如果仓库属于组织且被限制，改用下面的 PAT 方案                                                                            |
| 报 `is not allowed to deploy to github-pages due to environment protection rules` | `github-pages` 环境的部署规则拦住了 tag。Settings → Environments → `github-pages`，把 Deployment branches and tags 改成包含 `v*` 标签（或 All branches and tags）；若该环境还开了 Required reviewers，需要人工点 Approve 才能继续 |     |     |
| 线上白屏，控制台 asset 404                                                        | `base` 不对，检查 `--base=/vite-git/` 是否与仓库名一致                                                                                                                                                                            |
| 直接访问 `/about` 是 GitHub 的 404 页                                             | 缺少 `dist/404.html`，检查 SPA fallback 那一步是否执行                                                                                                                                                                            |
| CI 报 `ERR_PNPM_OUTDATED_LOCKFILE`                                                | 本地改了依赖但没提交 `pnpm-lock.yaml`；本地跑一次 `pnpm install` 后一起提交                                                                                                                                                       |
| `commit-msg` 钩子拒绝提交                                                         | 提交信息不符合约定式格式，参考第三节                                                                                                                                                                                              |
| `pre-commit` 报 `stylelint: not found`                                            | `lint-staged.config.js` 里配了 `stylelint`，但它没装。解决：`pnpm add -D stylelint stylelint-config-standard`，或从配置里删掉 `stylelint` 那几行                                                                                  |
| 本地 Node 版本警告                                                                | `engines` 要求 `^22.18.0 \|\| >=24.12.0`，CI 用的是 Node 24，建议本地也升到 24                                                                                                                                                    |
| Actions 日志出现 `Node.js 20 is deprecated` 警告                                  | 只是警告，不阻断运行；已把所有 Action 升到 Node 24 版本，不会再出现                                                                                                                                                               |

---

## 七、备选方案：用 PAT 代替 GITHUB_TOKEN

如果仓库属于组织、或组织策略把 Actions 权限锁成只读，创建 Pages 站点会一直失败。
这时可以用个人访问令牌（PAT）代替默认的 `GITHUB_TOKEN`：

1. 右上角头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**；
2. **Generate new token (classic)**，勾选 `repo`（完整仓库控制）和 `workflow`，生成后立刻复制；
3. 回到本仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，
   名称填 `GH_PAGES_TOKEN`，值粘贴刚才的 token；
4. 修改 `.github/workflows/deploy.yml`，给两个 Pages 步骤传入 token：

```yaml
- name: Configure Pages
  uses: actions/configure-pages@v6
  with:
    enablement: true
    token: ${{ secrets.GH_PAGES_TOKEN }}

- name: Deploy to GitHub Pages
  id: deployment
  uses: actions/deploy-pages@v5
  with:
    token: ${{ secrets.GH_PAGES_TOKEN }}
```

> PAT 等同于你的账号权限，泄露风险高。能用 `GITHUB_TOKEN`（即第二节那两步）就别用它。
