param(
    [switch]$Auto,
    [string[]]$Files = @(),
    [switch]$RestartOnly,
    [switch]$NoRestart,
    [switch]$Help
)
# 加载图形界面组件（兼容所有旧版PowerShell）
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ====================== 配置区（仅修改这里即可）======================
$localProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\projet"))
$serverRoot = "/opt/bigdogwoofwoof"
$sshKey = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\ZSHZJJXXiivv.pem"))
$serverIP = "119.91.224.223"
$serverUser = "ubuntu"
$serviceName = "bigdogwoofwoof-online"
$sshTimeoutSec = 45
$scpTimeoutSec = 120
$restartTimeoutSec = 90
$sshCommonArgs = @(
    "-i", $sshKey,
    "-o", "BatchMode=yes",
    "-o", "NumberOfPasswordPrompts=0",
    "-o", "ConnectTimeout=10",
    "-o", "ServerAliveInterval=5",
    "-o", "ServerAliveCountMax=2",
    "-o", "StrictHostKeyChecking=accept-new"
)
# ====================================================================

function Quote-ProcessArgument([string]$value){
    if($null -eq $value){
        return '""'
    }
    if($value -notmatch '[\s"]'){
        return $value
    }
    return '"' + ($value -replace '"','\"') + '"'
}

function Quote-RemoteArgument([string]$value){
    return "'" + ($value -replace "'", "'`"`"'") + "'"
}

function Invoke-TimedProcess([string]$filePath, [string[]]$argumentList, [int]$timeoutSec, [string]$label){
    $argString = ($argumentList | ForEach-Object { Quote-ProcessArgument ([string]$_) }) -join " "
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo.FileName = $filePath
    $process.StartInfo.Arguments = $argString
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $false
    $process.StartInfo.RedirectStandardError = $false
    try {
        if(-not $process.Start()){
            throw "$label 无法启动：$filePath"
        }
        if(-not $process.WaitForExit([Math]::Max(1, $timeoutSec) * 1000)){
            try { $process.Kill() } catch {}
            throw "$label 超时（>${timeoutSec}s），已终止。请检查网络、SSH key、服务器状态或远程命令是否等待交互输入。"
        }
        $process.WaitForExit()
        $exitCode = $process.ExitCode
        if($exitCode -ne 0){
            throw "$label 失败（exit $exitCode）。命令：$filePath $argString"
        }
    } finally {
        $process.Dispose()
    }
}

function Convert-ToRemoteRelativePath([string]$fullLocal){
    $normalizedLocal = [System.IO.Path]::GetFullPath($fullLocal).Replace("/","\")
    $normalizedRoot = [System.IO.Path]::GetFullPath($localProjectRoot).TrimEnd("\").Replace("/","\")
    if($normalizedLocal.StartsWith($normalizedRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)){
        return $normalizedLocal.Substring($normalizedRoot.Length).TrimStart("\")
    }

    $parts = $normalizedLocal -split "\\"
    $projectIndex = -1
    for($i = 0; $i -lt $parts.Count; $i++){
        if($parts[$i] -ieq "projet"){
            $projectIndex = $i
        }
    }
    if($projectIndex -ge 0 -and $projectIndex -lt ($parts.Count - 1)){
        return ($parts[($projectIndex + 1)..($parts.Count - 1)] -join "\")
    }

    throw "只能上传项目文件。支持：相对 $localProjectRoot 的路径，或任意版本目录下包含 \projet\ 的绝对路径。当前路径：$normalizedLocal"
}

function Show-CommandHelp(){
    Write-Host "用法："
    Write-Host "  .\一键上传界面.bat              打开图形界面"
    Write-Host "  .\一键上传界面.bat gui          打开图形界面"
    Write-Host "  .\一键上传界面.bat auto         上传默认更新文件并重启服务"
    Write-Host "  .\一键上传界面.bat file <文件/目录...> 上传指定文件或目录并重启服务"
    Write-Host "  .\一键上传界面.bat file-norestart <文件/目录...> 上传指定文件或目录但不重启"
    Write-Host "  .\一键上传界面.bat <文件/目录...>    直接上传指定文件或目录并重启服务（支持拖拽到 bat）"
    Write-Host "  .\一键上传界面.bat restart      只重启服务"
    Write-Host "  .\一键上传界面.bat help         显示帮助"
}

function Get-DefaultUploadFiles(){
    return @(
        "index.html",
        "modules/main.js",
        "api/runtime-api.js",
        "modules/api/ai-prompt-builder.js",
        "tool/runtime-fight.js",
        "server/online-battle-worker.js",
        "modules/duel/duel-hand.js",
        "modules/duel/duel-rule-subphase.js",
        "data/duel-domain-profiles-v0.1-candidate.json"
    )
}

function Resolve-UploadPath($path){
    $clean = ([string]$path).Trim().Trim('"')
    if([string]::IsNullOrWhiteSpace($clean)){
        throw "文件路径为空"
    }
    if([System.IO.Path]::IsPathRooted($clean)){
        return [System.IO.Path]::GetFullPath($clean)
    }
    $fromProject = [System.IO.Path]::GetFullPath((Join-Path $localProjectRoot $clean))
    if(Test-Path -LiteralPath $fromProject){
        return $fromProject
    }
    $fromCurrent = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $clean))
    if(Test-Path -LiteralPath $fromCurrent){
        return $fromCurrent
    }
    return $fromProject
}

function Get-RemotePath($localPath){
    $fullLocal = [System.IO.Path]::GetFullPath($localPath)
    $rel = (Convert-ToRemoteRelativePath $fullLocal).Replace("\","/")
    return "$serverRoot/$rel"
}

function Expand-UploadPath($path){
    $resolved = Resolve-UploadPath $path
    if(-not (Test-Path -LiteralPath $resolved)){
        throw "文件或目录不存在：$path"
    }
    $item = Get-Item -LiteralPath $resolved
    if(-not $item.PSIsContainer){
        return @($item.FullName)
    }

    $files = @(Get-ChildItem -LiteralPath $item.FullName -Recurse -File -Force | ForEach-Object { $_.FullName })
    if($files.Count -eq 0){
        throw "目录内没有可上传文件：$($item.FullName)"
    }
    return $files
}

function Upload-OneFile($localPath){
    if(-not (Test-Path -LiteralPath $localPath)){
        throw "文件不存在：$localPath"
    }
    $item = Get-Item -LiteralPath $localPath
    if($item.PSIsContainer){
        throw "当前只支持上传文件，不支持直接上传目录：$localPath"
    }
    $dest = Get-RemotePath $localPath
    $destDir = $dest -replace "/[^/]+$",""
    $remote = "$serverUser@$serverIP"
    $remoteTarget = "{0}@{1}:{2}" -f $serverUser, $serverIP, $dest
    Invoke-TimedProcess "ssh" ($sshCommonArgs + @($remote, ("mkdir -p " + (Quote-RemoteArgument $destDir)))) $sshTimeoutSec "创建远程目录 $destDir"
    Invoke-TimedProcess "scp" ($sshCommonArgs + @($localPath, $remoteTarget)) $scpTimeoutSec "上传文件 $localPath"
    Write-Host "uploaded $dest"
}

function Upload-OnePath($path){
    $files = @(Expand-UploadPath $path)
    if($files.Count -gt 1){
        Write-Host "uploading folder item: $path ($($files.Count) files)"
    }
    foreach($file in $files){
        Upload-OneFile $file
    }
}

function Restart-RemoteService(){
    $remote = "$serverUser@$serverIP"
    Invoke-TimedProcess "ssh" ($sshCommonArgs + @($remote, "sudo -n systemctl restart $serviceName")) $restartTimeoutSec "重启远程服务 $serviceName"
    Write-Host "service restarted"
}

function Upload-FilesAndMaybeRestart($paths){
    foreach($path in (Normalize-UploadFiles $paths)){
        Upload-OnePath $path
    }
    if(-not $NoRestart){
        Restart-RemoteService
    }
}

function Normalize-UploadFiles($paths){
    $result = @()
    foreach($path in @($paths)){
        $parts = [string]$path -split ","
        foreach($part in $parts){
            $clean = $part.Trim()
            if(-not [string]::IsNullOrWhiteSpace($clean)){
                $result += $clean
            }
        }
    }
    return $result
}

if($Help){
    Show-CommandHelp
    exit 0
}

if($RestartOnly){
    Restart-RemoteService
    exit 0
}

if($Auto -or $env:CODEX_AUTO_UPLOAD -eq "1"){
    Upload-FilesAndMaybeRestart (Get-DefaultUploadFiles)
    Write-Host "auto upload completed"
    exit 0
}

if($Files.Count -gt 0){
    Upload-FilesAndMaybeRestart $Files
    Write-Host "file upload completed"
    exit 0
}
# 创建主窗口
$form = New-Object System.Windows.Forms.Form
$form.Text = "文件上传更新工具 V2.14"
$form.Size = New-Object System.Drawing.Size(650,480)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.AllowDrop = $true

# 项目目录标签
$label = New-Object System.Windows.Forms.Label
$label.Text = "项目目录："
$label.Location = New-Object System.Drawing.Point(20,20)
$label.Size = New-Object System.Drawing.Size(80,20)
$form.Controls.Add($label)

# 路径输入框
$txtPath = New-Object System.Windows.Forms.TextBox
$txtPath.Location = New-Object System.Drawing.Point(100,20)
$txtPath.Size = New-Object System.Drawing.Size(400,20)
$txtPath.AllowDrop = $true
$form.Controls.Add($txtPath)

# 浏览文件按钮
$btnBrowse = New-Object System.Windows.Forms.Button
$btnBrowse.Text = "浏览文件"
$btnBrowse.Location = New-Object System.Drawing.Point(510,20)
$btnBrowse.Size = New-Object System.Drawing.Size(100,20)
$form.Controls.Add($btnBrowse)

# 添加到列表按钮
$btnAdd = New-Object System.Windows.Forms.Button
$btnAdd.Text = "添加到列表"
$btnAdd.Location = New-Object System.Drawing.Point(510,50)
$btnAdd.Size = New-Object System.Drawing.Size(100,20)
$form.Controls.Add($btnAdd)

# 文件列表框
$listBox = New-Object System.Windows.Forms.ListBox
$listBox.SelectionMode = 2
$listBox.Location = New-Object System.Drawing.Point(20,80)
$listBox.Size = New-Object System.Drawing.Size(590,200)
$listBox.AllowDrop = $true
$form.Controls.Add($listBox)

# 日志输出框
$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ScrollBars = 2
$logBox.ReadOnly = $true
$logBox.Location = New-Object System.Drawing.Point(20,300)
$logBox.Size = New-Object System.Drawing.Size(580,110)
$form.Controls.Add($logBox)

# 上传选中文件按钮
$btnUpload = New-Object System.Windows.Forms.Button
$btnUpload.Text = "上传选中文件"
$btnUpload.Location = New-Object System.Drawing.Point(20,420)
$btnUpload.Size = New-Object System.Drawing.Size(160,30)
$btnUpload.BackColor = "#4CAF50"
$btnUpload.ForeColor = "White"
$form.Controls.Add($btnUpload)

# 重启服务按钮
$btnRestart = New-Object System.Windows.Forms.Button
$btnRestart.Text = "重启服务器服务"
$btnRestart.Location = New-Object System.Drawing.Point(190,420)
$btnRestart.Size = New-Object System.Drawing.Size(160,30)
$btnRestart.BackColor = "#2196F3"
$btnRestart.ForeColor = "White"
$form.Controls.Add($btnRestart)

# 清空列表按钮
$btnClear = New-Object System.Windows.Forms.Button
$btnClear.Text = "清空列表"
$btnClear.Location = New-Object System.Drawing.Point(360,420)
$btnClear.Size = New-Object System.Drawing.Size(160,30)
$form.Controls.Add($btnClear)

# 日志输出函数
function Log($msg){
    $time = Get-Date -Format "HH:mm:ss"
    $logBox.AppendText("[$time] $msg`r`n")
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
    [System.Windows.Forms.Application]::DoEvents()
}

# 检查文件是否已在列表中
function IsExist($p){
    return $listBox.Items.Contains($p)
}

# 添加文件到列表
function AddFile($p){
    try {
        $resolved = Resolve-UploadPath $p
        if(-not (Test-Path -LiteralPath $resolved)){
            Log "错误：文件不存在：$p"
            return
        }
        $item = Get-Item -LiteralPath $resolved
        if(IsExist $resolved){
            Log "提示：条目已在列表中"
            return
        }
        [void]$listBox.Items.Add($resolved)
        if($item.PSIsContainer){
            $count = @(Expand-UploadPath $resolved).Count
            Log "成功：添加目录到列表 -> $resolved（$count 个文件）"
        } else {
            Log "成功：添加文件到列表 -> $resolved"
        }
    } catch {
        Log "错误：$($_.Exception.Message)"
    }
}

function HandleFileDropEnter($eventArgs){
    if($eventArgs.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)){
        $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    } else {
        $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
    }
}

function HandleFileDrop($eventArgs){
    if(-not $eventArgs.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)){
        return
    }
    foreach($path in @($eventArgs.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop))){
        AddFile $path
    }
}

$dragEnterHandler = {
    param($sender, $eventArgs)
    HandleFileDropEnter $eventArgs
}

$dragDropHandler = {
    param($sender, $eventArgs)
    HandleFileDrop $eventArgs
}

$form.Add_DragEnter($dragEnterHandler)
$form.Add_DragDrop($dragDropHandler)
$txtPath.Add_DragEnter($dragEnterHandler)
$txtPath.Add_DragDrop($dragDropHandler)
$listBox.Add_DragEnter($dragEnterHandler)
$listBox.Add_DragDrop($dragDropHandler)

# 浏览文件事件
$btnBrowse.Add_Click({
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.InitialDirectory = $localProjectRoot
    if($dialog.ShowDialog() -eq "OK"){
        AddFile $dialog.FileName
    }
})

# 手动添加事件
$btnAdd.Add_Click({
    AddFile $txtPath.Text
    $txtPath.Text = ""
})

# 清空列表事件
$btnClear.Add_Click({
    $listBox.Items.Clear()
    Log "提示：列表已清空"
})

# 上传文件事件
$btnUpload.Add_Click({
    if($listBox.SelectedItems.Count -eq 0){
        Log "提示：请先选择要上传的文件"
        return
    }
    $btnUpload.Enabled = $false
    Log "提示：开始上传文件..."
    try {
        foreach($local in @($listBox.SelectedItems)){
            Upload-OnePath $local
            Log "成功：上传条目 $local"
        }
        Log "提示：所有文件上传完成"
    } catch {
        Log "错误：上传中断：$($_.Exception.Message)"
    } finally {
        $btnUpload.Enabled = $true
    }
})

# 重启服务事件
$btnRestart.Add_Click({
    $btnRestart.Enabled = $false
    Log "提示：正在重启服务..."
    try {
        Restart-RemoteService
        Log "成功：服务重启完成"
    } catch {
        Log "错误：重启失败：$($_.Exception.Message)"
    } finally {
        $btnRestart.Enabled = $true
    }
})

# 显示窗口
$form.ShowDialog()

