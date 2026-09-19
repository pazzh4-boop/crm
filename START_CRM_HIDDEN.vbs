Option Explicit

Dim shell, fileSystem, baseDirectory, powershellPath, serverPath, command

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

baseDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
serverPath = fileSystem.BuildPath(baseDirectory, "crm_server.ps1")

command = Chr(34) & powershellPath & Chr(34) & _
  " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File " & _
  Chr(34) & serverPath & Chr(34)

shell.Run command, 0, False
