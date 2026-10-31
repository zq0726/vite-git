import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tag = `v${version}`

const exists = execSync(`git rev-parse -q --verify refs/tags/${tag} || true`).toString().trim()
if (exists) {
  console.error(`标签 ${tag} 已存在，请先修改 package.json 中的 version`)
  process.exit(1)
}

execSync(`git tag -a ${tag} -m "${tag}"`, { stdio: 'inherit' })
execSync(`git push origin ${tag}`, { stdio: 'inherit' })
console.log(`\n已推送 ${tag}，GitHub Actions 会自动部署到 GitHub Pages`)
