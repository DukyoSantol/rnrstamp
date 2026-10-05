' Run RNR hidden without console window
Set WshShell = CreateObject("WScript.Shell")
appPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run appPath & "\rnr_v2.exe", 0, False