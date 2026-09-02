# 开发环境依赖服务的启停管理（PostgreSQL + Redis）
#
# 用法：
#   powershell -NoProfile -File scripts\dev-services.ps1 start
#   powershell -NoProfile -File scripts\dev-services.ps1 stop
#   powershell -NoProfile -File scripts\dev-services.ps1 status
#   powershell -NoProfile -File scripts\dev-services.ps1 restart
#
# 为什么用 Start-Process 而不是别的方式（踩过的坑）：
#   1. `pg_ctl start` 在 Windows 下会阻塞并持有服务进程树 —— 一旦调用方
#      （比如 AI 工具的后台任务）被清理，PostgreSQL 会被连带杀死。
#      所以直接跑 postgres.exe 并用 Start-Process 脱离父进程。
#   2. Redis 是 cygwin 构建：命令行传 /cygdrive/e/... 会被 Git Bash 的
#      路径转换搞坏，必须用工作目录 + 相对路径 redis.conf。
#   3. Redis 进程偶尔会自行退出，status 子命令用来快速确认。

param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'status'
)

$PgHome   = 'E:\PostgreSQL'
$PgData   = 'E:\PostgreSQL\data'
$RedisDir = 'E:\Redis'

function Test-Port([int]$Port) {
    $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Show-Status {
    $pg    = if (Test-Port 5432) { 'LISTENING' } else { 'DOWN' }
    $redis = if (Test-Port 6379) { 'LISTENING' } else { 'DOWN' }
    Write-Host ("PostgreSQL 5432 : {0}" -f $pg)
    Write-Host ("Redis      6379 : {0}" -f $redis)
}

function Start-Services {
    if (Test-Port 5432) {
        Write-Host 'PostgreSQL 已在运行'
    } else {
        Start-Process -FilePath "$PgHome\bin\postgres.exe" `
            -ArgumentList '-D', $PgData -WindowStyle Hidden
        Write-Host 'PostgreSQL 启动中...'
    }

    if (Test-Port 6379) {
        Write-Host 'Redis 已在运行'
    } else {
        # 必须指定 WorkingDirectory + 相对路径，见文件头说明
        Start-Process -FilePath "$RedisDir\redis-server.exe" `
            -ArgumentList 'redis.conf' -WorkingDirectory $RedisDir -WindowStyle Hidden
        Write-Host 'Redis 启动中...'
    }

    Start-Sleep -Seconds 5
    Show-Status
}

function Stop-Services {
    # Redis 优雅关闭：让它落盘 RDB 再退出，否则最近的写入会丢
    if (Test-Port 6379) {
        & "$RedisDir\redis-cli.exe" shutdown nosave 2>$null
        Write-Host 'Redis 已关闭'
    }
    # PostgreSQL 用 pg_ctl fast 关闭（回滚未完成事务并落盘）
    if (Test-Port 5432) {
        & "$PgHome\bin\pg_ctl.exe" -D $PgData -m fast stop 2>$null
        Write-Host 'PostgreSQL 已关闭'
    }
    Start-Sleep -Seconds 2
    Show-Status
}

switch ($Action) {
    'start'   { Start-Services }
    'stop'    { Stop-Services }
    'status'  { Show-Status }
    'restart' { Stop-Services; Start-Sleep -Seconds 2; Start-Services }
}
