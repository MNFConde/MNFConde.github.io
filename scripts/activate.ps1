# 按需激活 Node 环境（会话级）：PowerShell 脚本的 env 变更同进程持久，执行一次整会话生效
fnm env --use-on-cd | Out-String | Invoke-Expression
if (Test-Path .nvmrc) { fnm use } else { fnm use default }
