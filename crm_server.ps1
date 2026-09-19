$ErrorActionPreference = "Stop"

# VIP CRM Local Bridge — Windows PowerShell, no Python required.
# Serves CRM on http://127.0.0.1:8765 and proxies /being-api to Google Apps Script.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$HostAddress = "127.0.0.1"
$Port = 8765
$NoBrowser = $args -contains "-NoBrowser"
# The CRM window stays over other applications unless this is passed.
$NoAlwaysOnTop = $args -contains "-NoAlwaysOnTop"
$portArgumentIndex = [Array]::IndexOf($args, "-Port")

if ($portArgumentIndex -ge 0 -and $portArgumentIndex + 1 -lt $args.Count) {
    $requestedPort = 0
    if ([int]::TryParse([string]$args[$portArgumentIndex + 1], [ref]$requestedPort)) {
        $Port = $requestedPort
    }
}

$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $BaseDir "being_config.json"
$script:ShutdownRequested = $false
$script:CloseDeadline = $null

$BlockedFiles = @(
    "being_config.json",
    "crm_server.ps1",
    "START_CRM.bat",
    "START_CRM_HIDDEN.vbs",
    "DIAGNOSE_CRM.bat"
)

function Write-Banner {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host "  VIP CRM LOCAL SERVER - POWERSHELL"
    Write-Host "============================================================"
    Write-Host ""
}

function Open-VipCrmWindow {
    param([string]$Url)

    $browserCandidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    $browserPath = $browserCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1

    if (-not $browserPath) {
        Start-Process $Url
        return
    }

    $profileRoot = Join-Path $env:LOCALAPPDATA "VIPCRM"
    $profilePath = Join-Path $profileRoot "BrowserProfile"
    New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

    # The CRM is a window, not a tab: it opens in the top-left corner, large
    # enough to read the sync progress. Once the data is in, the page shrinks
    # the window down to the small corner object holding the one button, and
    # opening a screen takes the whole display.
    $arguments = @(
        "--app=$Url",
        "--user-data-dir=`"$profilePath`"",
        "--window-position=0,0",
        "--window-size=420,300",
        # Pins the browser UI locale, and with it the native date-picker format
        # to MM/DD/YYYY. Without it the quest date fields follow whatever
        # language Edge/Chrome happens to be installed in.
        "--lang=en-US",
        "--disable-background-mode",
        "--force-dark-mode",
        "--enable-features=WebUIDarkMode",
        "--no-first-run"
    )

    Start-Process `
        -FilePath $browserPath `
        -ArgumentList $arguments `
        -WindowStyle Normal | Out-Null

    $script:BrowserProfilePath = $profilePath
}

<#
    ALWAYS ON TOP

    The CRM is a small window that is meant to stay in the corner while other
    applications are worked in; without this it goes behind the first thing
    clicked. Windows owns the z-order, so this is the OS call for it rather
    than anything the page can ask for.

    The flag is re-applied on a timer because a window that resizes itself -
    which this one does, every time a screen opens - can come back out of the
    topmost band.
#>
$script:VipCrmWindowHandle = [IntPtr]::Zero
$script:BrowserProfilePath = $null
$script:TopmostNextScan = [DateTime]::MinValue

if (-not ('VipCrmWindowApi' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct VipCrmRect { public int Left, Top, Right, Bottom; }

public static class VipCrmWindowApi {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
'@
}

function Find-VipCrmWindowHandle {
    if ([string]::IsNullOrWhiteSpace($script:BrowserProfilePath)) { return [IntPtr]::Zero }

    try {
        $owners = Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction Stop |
            Where-Object { $_.CommandLine -and $_.CommandLine.Contains($script:BrowserProfilePath) }

        foreach ($owner in $owners) {
            $process = Get-Process -Id $owner.ProcessId -ErrorAction SilentlyContinue
            if ($process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
                return $process.MainWindowHandle
            }
        }
    } catch {
        # The window will be looked for again on the next pass.
    }

    return [IntPtr]::Zero
}

function Update-VipCrmTopmost {
    if ($NoAlwaysOnTop) { return }
    if ([DateTime]::UtcNow -lt $script:TopmostNextScan) { return }

    $script:TopmostNextScan = [DateTime]::UtcNow.AddSeconds(2)

    if (
        $script:VipCrmWindowHandle -eq [IntPtr]::Zero -or
        -not [VipCrmWindowApi]::IsWindow($script:VipCrmWindowHandle)
    ) {
        $script:VipCrmWindowHandle = Find-VipCrmWindowHandle
        if ($script:VipCrmWindowHandle -eq [IntPtr]::Zero) { return }
        Write-Host "[VIP CRM] Window pinned above other applications."
    }

    $WS_EX_TOPMOST = 0x8
    $GWL_EXSTYLE = -20
    $exStyle = [VipCrmWindowApi]::GetWindowLong($script:VipCrmWindowHandle, $GWL_EXSTYLE)
    if (($exStyle -band $WS_EX_TOPMOST) -ne 0) { return }

    $HWND_TOPMOST = [IntPtr](-1)
    # NOSIZE | NOMOVE | NOACTIVATE: only the z-order changes, and the window
    # is not pulled to the front of the user's attention while they type
    # somewhere else.
    [VipCrmWindowApi]::SetWindowPos($script:VipCrmWindowHandle, $HWND_TOPMOST, 0, 0, 0, 0, 0x13) | Out-Null
}

$script:BeingConfigCache = $null
$script:BeingConfigStamp = $null

function Get-BeingConfig {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "being_config.json was not found."
    }

    # The file was read and parsed again on every proxied request. It is cached
    # against its own write time instead, so editing it still takes effect
    # without restarting the bridge.
    $stamp = (Get-Item -LiteralPath $ConfigPath).LastWriteTimeUtc.Ticks
    if ($script:BeingConfigCache -and $script:BeingConfigStamp -eq $stamp) {
        return $script:BeingConfigCache
    }

    $raw = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8
    $config = $raw | ConvertFrom-Json

    $webAppUrl = [string]$config.web_app_url
    $apiKey = [string]$config.api_key

    $webAppUrl = $webAppUrl.Trim()
    $apiKey = $apiKey.Trim()

    if (
        [string]::IsNullOrWhiteSpace($webAppUrl) -or
        $webAppUrl -like "PASTE_*" -or
        $webAppUrl -notmatch '^https://script\.google\.com/macros/s/.+/exec(?:\?.*)?$'
    ) {
        throw "Set your Google Apps Script /exec URL in being_config.json."
    }

    if (
        [string]::IsNullOrWhiteSpace($apiKey) -or
        $apiKey -like "PASTE_*"
    ) {
        throw "Set your API key in being_config.json."
    }

    $script:BeingConfigCache = @{
        WebAppUrl = $webAppUrl
        ApiKey = $apiKey
    }
    $script:BeingConfigStamp = $stamp

    return $script:BeingConfigCache
}

function ConvertTo-UrlEncoded {
    param([string]$Value)

    return [System.Uri]::EscapeDataString(
        [string]$Value
    ).Replace("%20", "+")
}

function ConvertFrom-UrlEncoded {
    param([string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    return [System.Uri]::UnescapeDataString(
        ([string]$Value).Replace("+", " ")
    )
}

function Parse-QueryString {
    param([string]$Query)

    $result = @{}

    if ([string]::IsNullOrWhiteSpace($Query)) {
        return $result
    }

    foreach ($piece in $Query.TrimStart("?").Split("&")) {
        if ([string]::IsNullOrWhiteSpace($piece)) {
            continue
        }

        $parts = $piece.Split("=", 2)
        $key = ConvertFrom-UrlEncoded $parts[0]
        $value = ""

        if ($parts.Count -gt 1) {
            $value = ConvertFrom-UrlEncoded $parts[1]
        }

        $result[$key] = $value
    }

    return $result
}

function Build-QueryString {
    param([hashtable]$Parameters)

    $pairs = New-Object System.Collections.Generic.List[string]

    foreach ($key in $Parameters.Keys) {
        $encodedKey = ConvertTo-UrlEncoded ([string]$key)
        $encodedValue = ConvertTo-UrlEncoded ([string]$Parameters[$key])
        $pairs.Add("$encodedKey=$encodedValue")
    }

    return [string]::Join("&", $pairs)
}

function Get-MimeType {
    param([string]$Path)

    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".svg"  { return "image/svg+xml" }
        ".ico"  { return "image/x-icon" }
        ".webp" { return "image/webp" }
        ".txt"  { return "text/plain; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

function Get-StatusText {
    param([int]$Status)

    switch ($Status) {
        200 { return "OK" }
        400 { return "Bad Request" }
        403 { return "Forbidden" }
        404 { return "Not Found" }
        405 { return "Method Not Allowed" }
        500 { return "Internal Server Error" }
        502 { return "Bad Gateway" }
        default { return "OK" }
    }
}

function Send-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$Status,
        [string]$ContentType,
        [byte[]]$Body
    )

    if ($null -eq $Body) {
        $Body = [byte[]]@()
    }

    $statusText = Get-StatusText $Status

    $header = (
        "HTTP/1.1 $Status $statusText`r`n" +
        "Content-Type: $ContentType`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Cache-Control: no-store`r`n" +
        "Connection: close`r`n" +
        "X-Content-Type-Options: nosniff`r`n" +
        "`r`n"
    )

    $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }

    $Stream.Flush()
}

function Send-Json {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$Status,
        $Payload
    )

    $json = $Payload | ConvertTo-Json -Compress -Depth 20
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)

    Send-HttpResponse `
        -Stream $Stream `
        -Status $Status `
        -ContentType "application/json; charset=utf-8" `
        -Body $bytes
}

function Read-HttpRequest {
    param([System.Net.Sockets.NetworkStream]$Stream)

    # Read request headers byte-by-byte so we do not consume body bytes
    # into an opaque StreamReader buffer.
    $headerBuffer = New-Object System.IO.MemoryStream
    $last4 = New-Object byte[] 4
    $last4Count = 0

    while ($true) {
        $value = $Stream.ReadByte()

        if ($value -lt 0) {
            throw "Client disconnected before request headers completed."
        }

        $headerBuffer.WriteByte([byte]$value)

        if ($last4Count -lt 4) {
            $last4[$last4Count] = [byte]$value
            $last4Count++
        }
        else {
            $last4[0] = $last4[1]
            $last4[1] = $last4[2]
            $last4[2] = $last4[3]
            $last4[3] = [byte]$value
        }

        if (
            $last4Count -eq 4 -and
            $last4[0] -eq 13 -and
            $last4[1] -eq 10 -and
            $last4[2] -eq 13 -and
            $last4[3] -eq 10
        ) {
            break
        }

        if ($headerBuffer.Length -gt 65536) {
            throw "HTTP request headers are too large."
        }
    }

    $headerText = [Text.Encoding]::ASCII.GetString(
        $headerBuffer.ToArray()
    )

    $lines = $headerText -split "`r`n"

    if ($lines.Count -lt 1) {
        throw "Invalid HTTP request."
    }

    $requestLine = $lines[0].Split(" ")

    if ($requestLine.Count -lt 2) {
        throw "Invalid HTTP request line."
    }

    $method = $requestLine[0].ToUpperInvariant()
    $target = $requestLine[1]

    $headers = @{}

    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $separator = $line.IndexOf(":")

        if ($separator -le 0) {
            continue
        }

        $name = $line.Substring(0, $separator).Trim().ToLowerInvariant()
        $value = $line.Substring($separator + 1).Trim()
        $headers[$name] = $value
    }

    $contentLength = 0

    if ($headers.ContainsKey("content-length")) {
        [void][int]::TryParse(
            [string]$headers["content-length"],
            [ref]$contentLength
        )
    }

    $bodyBytes = New-Object byte[] $contentLength
    $offset = 0

    while ($offset -lt $contentLength) {
        $read = $Stream.Read(
            $bodyBytes,
            $offset,
            $contentLength - $offset
        )

        if ($read -le 0) {
            throw "Client disconnected before request body completed."
        }

        $offset += $read
    }

    $bodyText = ""

    if ($contentLength -gt 0) {
        $bodyText = [Text.Encoding]::UTF8.GetString($bodyBytes)
    }

    return @{
        Method = $method
        Target = $target
        Headers = $headers
        Body = $bodyText
    }
}

function Invoke-GoogleGet {
    param(
        [string]$Action,
        [hashtable]$Query
    )

    $config = Get-BeingConfig
    $parameters = @{}

    foreach ($key in $Query.Keys) {
        if ($key -eq "_" -or $key -eq "apiKey") {
            continue
        }

        $parameters[$key] = [string]$Query[$key]
    }

    $parameters["action"] = $Action
    $parameters["apiKey"] = $config.ApiKey

    $separator = "?"

    if ($config.WebAppUrl.Contains("?")) {
        $separator = "&"
    }

    $url = (
        $config.WebAppUrl +
        $separator +
        (Build-QueryString $parameters)
    )

    # Apps Script can spend a while on the wide 365 sheet on a cold start.
    $response = Invoke-WebRequest `
        -Uri $url `
        -Method Get `
        -UseBasicParsing `
        -MaximumRedirection 10 `
        -TimeoutSec 60 `
        -Headers @{
            "Accept" = "application/json"
            "User-Agent" = "VIP-CRM-PowerShell-Bridge/1.0"
        }

    return [string]$response.Content
}

function Invoke-GooglePost {
    param($Payload)

    $config = Get-BeingConfig

    if ($null -eq $Payload) {
        throw "Invalid JSON payload."
    }

    $payloadHash = @{}

    foreach ($property in $Payload.PSObject.Properties) {
        $payloadHash[$property.Name] = $property.Value
    }

    $payloadHash["apiKey"] = $config.ApiKey

    $payloadJson = $payloadHash |
        ConvertTo-Json -Compress -Depth 20

    # A save waits for the script lock before it writes anything. Cutting the
    # request off at 30s abandoned writes that were about to succeed, and the
    # browser reported them as rolled back.
    $response = Invoke-WebRequest `
        -Uri $config.WebAppUrl `
        -Method Post `
        -UseBasicParsing `
        -MaximumRedirection 10 `
        -TimeoutSec 120 `
        -Headers @{
            "Accept" = "application/json"
            "User-Agent" = "VIP-CRM-PowerShell-Bridge/1.0"
        } `
        -ContentType "application/x-www-form-urlencoded; charset=UTF-8" `
        -Body @{
            payload = $payloadJson
        }

    return [string]$response.Content
}

function Serve-StaticFile {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$RequestPath
    )

    if ([string]::IsNullOrWhiteSpace($RequestPath) -or $RequestPath -eq "/") {
        $RequestPath = "/index.html"
    }

    $decoded = [Uri]::UnescapeDataString($RequestPath)
    $relative = $decoded.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)

    if ([string]::IsNullOrWhiteSpace($relative)) {
        $relative = "index.html"
    }

    $fileName = [IO.Path]::GetFileName($relative)

    if ($BlockedFiles -contains $fileName) {
        Send-Json -Stream $Stream -Status 404 -Payload @{
            ok = $false
            error = "Not found."
        }
        return
    }

    $fullPath = [IO.Path]::GetFullPath(
        (Join-Path $BaseDir $relative)
    )

    $baseFull = [IO.Path]::GetFullPath($BaseDir)

    if (-not $fullPath.StartsWith($baseFull, [StringComparison]::OrdinalIgnoreCase)) {
        Send-Json -Stream $Stream -Status 403 -Payload @{
            ok = $false
            error = "Forbidden."
        }
        return
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Send-Json -Stream $Stream -Status 404 -Payload @{
            ok = $false
            error = "Not found."
        }
        return
    }

    $bytes = [IO.File]::ReadAllBytes($fullPath)
    $mime = Get-MimeType $fullPath

    Send-HttpResponse `
        -Stream $Stream `
        -Status 200 `
        -ContentType $mime `
        -Body $bytes
}

function Handle-Client {
    param([System.Net.Sockets.TcpClient]$Client)

    $stream = $Client.GetStream()

    try {
        $request = Read-HttpRequest $stream

        $targetUri = [Uri](
            "http://localhost" + $request.Target
        )

        $path = $targetUri.AbsolutePath
        $query = Parse-QueryString $targetUri.Query

        if ($path -eq "/crm-control") {
            if ($request.Method -eq "GET") {
                $action = [string]$query["action"]

                if ($action -ne "ping") {
                    Send-Json -Stream $stream -Status 400 -Payload @{
                        ok = $false
                        error = "Unknown CRM control action."
                    }
                    return
                }

                Send-Json -Stream $stream -Status 200 -Payload @{
                    ok = $true
                    service = "VIP CRM Local Control"
                    status = "online"
                }
                return
            }

            if ($request.Method -eq "POST") {
                try {
                    $payload = $request.Body | ConvertFrom-Json
                    $action = [string]$payload.action

                    switch ($action) {
                        "heartbeat" {
                            $script:CloseDeadline = $null
                        }
                        "window-closing" {
                            $script:CloseDeadline = [DateTime]::UtcNow.AddSeconds(6)
                        }
                        "shutdown" {
                            $script:ShutdownRequested = $true
                            $script:CloseDeadline = $null
                        }
                        default {
                            Send-Json -Stream $stream -Status 400 -Payload @{
                                ok = $false
                                error = "Unknown CRM control action."
                            }
                            return
                        }
                    }

                    Send-Json -Stream $stream -Status 200 -Payload @{
                        ok = $true
                        action = $action
                    }
                }
                catch {
                    Send-Json -Stream $stream -Status 400 -Payload @{
                        ok = $false
                        error = "Invalid CRM control request."
                    }
                }

                return
            }

            Send-Json -Stream $stream -Status 405 -Payload @{
                ok = $false
                error = "Method not allowed."
            }
            return
        }

        if ($path -eq "/being-api") {
            if ($request.Method -eq "GET") {
                $action = "getClients"

                if ($query.ContainsKey("action")) {
                    $action = [string]$query["action"]
                }

                try {
                    if ($action -eq "updatePinned") {
                        $clientLabel = [string]$query["clientId"]
                        $pinnedLabel = [string]$query["pinned"]
                        Write-Host "[Being API] GET updatePinned | ID: $clientLabel | Pinned: $pinnedLabel"
                    }

                    $jsonText = Invoke-GoogleGet `
                        -Action $action `
                        -Query $query

                    $bytes = [Text.Encoding]::UTF8.GetBytes($jsonText)

                    Send-HttpResponse `
                        -Stream $stream `
                        -Status 200 `
                        -ContentType "application/json; charset=utf-8" `
                        -Body $bytes
                }
                catch {
                    Send-Json -Stream $stream -Status 502 -Payload @{
                        ok = $false
                        error = "Google Apps Script request failed: $($_.Exception.Message)"
                    }
                }

                return
            }

            if ($request.Method -eq "POST") {
                try {
                    $payload = $request.Body | ConvertFrom-Json

                    $actionLabel = [string]$payload.action
                    $clientLabel = [string]$payload.clientId
                    Write-Host "[Being API] POST $actionLabel | ID: $clientLabel"

                    $jsonText = Invoke-GooglePost `
                        -Payload $payload

                    $bytes = [Text.Encoding]::UTF8.GetBytes($jsonText)

                    Send-HttpResponse `
                        -Stream $stream `
                        -Status 200 `
                        -ContentType "application/json; charset=utf-8" `
                        -Body $bytes
                }
                catch {
                    Send-Json -Stream $stream -Status 502 -Payload @{
                        ok = $false
                        error = "Google Apps Script request failed: $($_.Exception.Message)"
                    }
                }

                return
            }

            Send-Json -Stream $stream -Status 405 -Payload @{
                ok = $false
                error = "Method not allowed."
            }
            return
        }

        if ($request.Method -ne "GET") {
            Send-Json -Stream $stream -Status 405 -Payload @{
                ok = $false
                error = "Method not allowed."
            }
            return
        }

        Serve-StaticFile `
            -Stream $stream `
            -RequestPath $path
    }
    catch {
        try {
            Send-Json -Stream $stream -Status 500 -Payload @{
                ok = $false
                error = $_.Exception.Message
            }
        }
        catch {
        }
    }
    finally {
        try { $stream.Close() } catch {}
        try { $Client.Close() } catch {}
    }
}

Write-Banner

try {
    [void](Get-BeingConfig)
    Write-Host "[OK] Google Sheet configuration found."
    Write-Host "[OK] Apps Script URL ends in /exec."
    Write-Host ""
}
catch {
    Write-Host "[CONFIGURATION REQUIRED]" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Open being_config.json and paste:"
    Write-Host "  web_app_url = your Apps Script /exec URL"
    Write-Host "  api_key     = your API key"
    Write-Host ""
    Write-Host "The server will still start, but Being cannot sync until config is valid."
    Write-Host ""
}

$listener = New-Object System.Net.Sockets.TcpListener(
    [Net.IPAddress]::Parse($HostAddress),
    $Port
)

try {
    $listener.Start()
}
catch {
    Write-Host "[ERROR] Local server could not start." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "If port 8765 is already in use, close the old VIP CRM server window."
    exit 2
}

Write-Host "[VIP CRM] Running:"
Write-Host "http://${HostAddress}:${Port}/" -ForegroundColor Green
Write-Host ""
if (-not $NoAlwaysOnTop) {
    Write-Host "The CRM window stays above other applications. Start with -NoAlwaysOnTop to turn that off."
}
Write-Host "The CRM window controls safe shutdown."
Write-Host "Use Save & Exit or close the CRM app window to stop the server."
Write-Host ""

if (-not $NoBrowser) {
    Open-VipCrmWindow "http://${HostAddress}:${Port}/"
}

try {
    while (-not $script:ShutdownRequested) {
        if (
            $null -ne $script:CloseDeadline -and
            [DateTime]::UtcNow -ge $script:CloseDeadline
        ) {
            Write-Host "[VIP CRM] App window closed. Stopping local server."
            break
        }

        Update-VipCrmTopmost

        <#
            Waiting on the socket itself rather than polling it every 100ms.
            The old loop asked whether anything had arrived, slept a tenth of
            a second and asked again, so every single request - every keypress
            that saves, every screen that loads - started with up to 100ms of
            doing nothing. Poll returns the moment a connection lands and
            costs nothing while it waits; the timeout is only there so the
            shutdown check and the topmost pass still come round.
        #>
        if ($listener.Server.Poll(200000, [System.Net.Sockets.SelectMode]::SelectRead)) {
            $client = $listener.AcceptTcpClient()
            Handle-Client $client
        }
    }
}
finally {
    try { $listener.Stop() } catch {}
}
