Output demo.gif
Set FontSize 16
Set Width 1200
Set Height 800
Set Padding 20
Set Theme { "background": "#1e1e2e", "foreground": "#cdd6f4" }

Type "csviz revenue.csv"
Sleep 500ms
Enter
Sleep 2s

Type "csviz revenue.csv -t bar -c Revenue"
Sleep 500ms
Enter
Sleep 2s

Type "csviz revenue.csv -t spark -c Revenue"
Sleep 500ms
Enter
Sleep 1s
