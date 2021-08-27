```plantuml

!includeurl https://raw.githubusercontent.com/matthewjosephtaylor/plantuml-style/master/style.pu

top to bottom direction

database "STORES"                  as stres
file     "オーダー情報CSV"         as order
file     "ヤマト送り状CSV"         as ymtin
file     "オーダーチェック用CSV"   as ordch
file     "ヤマト送り状CVS（追加）" as ymtot

stres --> order
stres --> ymtin

order ---> ordch
note right
  チェックに必要な項目を抽出
  チェックしやすいように加工
end note

order --> ymtot : 未入金を抽出
ymtin --> ymtot : 定形情報を入力

```
