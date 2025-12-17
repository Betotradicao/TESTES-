Get-NetIPInterface | Where-Object {extglob.InterfaceAlias -like '*Wi-Fi*'} | Select-Object InterfaceAlias, Forwarding | Format-Table
