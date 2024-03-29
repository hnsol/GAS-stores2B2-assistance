# GAS-stores2B2-assistance

送り状データの編集支援：STORESデータをヤマトB2クラウドデータに変換

## はじめに

[Stores（ストアーズ）](https://stores.jp/ec)には[「送り状CSV出力（ヤマトB2クラウド）」](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)という機能があって、送り状を簡単に作成できる……はず……だが……。

おおまかな業務のワークフロー（作業の流れ）は下図の通り。お客様から注文をいただいて、発送する。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Context_before.png" width=75%>

STORESから送り状用のCSVがダウンロードでき、「[手書き作業やデータのコピー＆ペーストの手間を省き、送り状発行業務の効率化](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)」になるはずだが（なっていると思うが）、それでも意外とパソコン作業に手間がかかる。

たとえば、送り状CSVデータをダウンロードしたら、Excelで編集したい人が多いと思う。ところが、データフィールド（項目）の冒頭がゼロだと、ゼロが消えてしまう。

> 電話番号フィールド`09087654321`を取り込むと`9087654321`となる。郵便番号も、北海道はゼロから始まる！

そのほかにも（ショップ固有の条件で）いろいろ手作業がある。これらの自動化をGAS(Google Apps Script)で行った。概算だが、時間にして45%、送り状作成作業を短縮できた。

<br>

## 全体ワークフローと、「コンピュータに任せたい」こと

ワークフローをもう少し拡大する。下図の青塗り「出荷作業支援」がGASが自動化するところ。手作業をなるべく減らし、ミスや手戻りがなくなるよう、コンピュータが得意なことは、コンピュータにお願いする。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Context.png" width=75%>


### コンピュータに任せたいこと

1. CSVの、フィールド１文字目がゼロの場合、Excelに取り込むとゼロが消える　⇒　消えないように取り込んでほしい

2. 送り状CSVデータは、「未発送」のみが出力対象　⇒　「未入金」レコードも、送り状CSVに取り込んでほしい

> - STORESのCSV書き出し機能の仕様。オプション指定不可
> - 送り状の作成の着手が遅くなり、急ぐとミスが起きがち
> - 手作業でデータを取り込むとミスが多発しそうで怖い

3. 送り状CSVデータの「依頼主」が固定値（ショップ）　⇒　ギフトの場合は書き換えてほしい

> - 「オーダー情報で購入者と配送先が異なる」のは、**ギフト利用**なので、「送り状CSVの依頼主＝オーダー情報の購入者」としたい
> - STORESの仕様で、「送り主」には必ずショップの住所・氏名が入っている
> - 手作業で書き換えているが、ミスが発生しそうで怖い

4. いくつかの列は固定値なので、自動的に埋めておいてほしい

> - たとえば請求先コードは、すべてのレコードで同じ値でよい
> - 手作業（Excelのコピペ）でもできるが、コンピュータが得意なことはコンピュータに任せたい

5. 出荷時チェック用のシートを自動的に出力してほしい

> - オーダー情報（もっとも正しいデータ）と照らし合わせ、最終チェックを行いたい
> - オーダー情報のうち、不要な箇所を取り除くことと、必要な箇所を強調すること（たとえば「要領収書」）は、自動的にやってもらえるととても助かる

<br>

## もう少し詳細なワークフロー

STORESからCSVを受け取り、配送を依頼するまでの範囲のワークフローを拡大すると、下図のようになる。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Container.png" width=75%>

STORESからは、「オーダー」と「送り状」の2つのCSVをダウンロードすることができる。これらのCSVから、「チェックシート」と「送り状CSVを加工したシート」を作成する。

- チェックシートは、できたものを印刷する。最終的な目視確認で使用
- 送り状CSVを加工し、これをエクセルシートにコピペする

<br>

## GAS(Google Apps Script)で行うこと

GASで行うタスクに絞って拡大すると、下図の通りとなる。

![img](https://i.gyazo.com/eea581bbbe1b3913c1ce0e9f4aa6dcb3.png)

<br>

### ヤマト送り状作成支援

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Component_B2.png" width=100%>

1. オーダー情報CSVのうち、`01 ステータス`が`未入金`であるレコードを抽出し、送り状CSV形式（ヤマトB2クラウドに流せる形式）に変換する
> - レコードが複数ある場合（注文品が複数の場合）、品名を`, `で連結
> - お届け先名は、氏と名を` `（半角スペース）で連結
> - そのほかは、オーダー情報からのコピーもしくは固定値
2. 抽出したものと、ダウンロードした送り状CSVを連結する
> GASの配列上で行う
3. 機械的に埋められる項目を埋める
> - 配送先≠購入者の場合は、オーダー情報からデータを抽出して置き換える
> - そのほかは、固定値を埋められるものを埋める

<br>

### オーダー情報からチェックシートを作成

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Component_order.png" width=100%>

1. 必要列に絞り、チェックしやすいよう順番を入れ替える
2. 購入者情報は、配送先≠購入者のときだけ表示（配送先＝購入者の場合は空欄に置き換える）
3. オーダー番号は、1行目のみ表示する

<br>

## 参考：ユーザ操作画面

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/SS_configsheet.png" width="320px">

<br>

## function structure




| #01           | #02                  | #03                |
| ------------- | -------------------- | ------------------ |
| buttonStart() | generateInvoiceSht() | initConfig         |
|               |                      | sht2arr            |
|               |                      | clipWPLine         |
|               |                      | mapOrderToB2       |
|               |                      | modifySenderYamato | 
|               |                      | concat2DArray      |
|               |                      | formatYamatB2      |
|               |                      | outputArray2Sht    |
|               | generateOrderCkSht() | initConfig         |
|               |                      | sht2arr            |
|               |                      | formatOrder4Check  |
|               |                      | outputArray2Sht    |
|               |                      |                    |

| #02                  | #03                | #04                   | #05            |
| -------------------- | ------------------ | --------------------- | -------------- |
| generateInvoiceSht() | initConfig         | convertSht2Obj        |                |
|                      | sht2arr            |                       |                |
|                      | clipWPLine         | clipLine              |                |
|                      |                    | groupConcat           |                |
|                      | mapOrderToB2       |                       |                |
|                      | modifySenderYamato |                       |                |
|                      | concat2DArray      |                       |                |
|                      | formatYamatB2      | sortByOrderDate       |                |
|                      |                    | xxxUme                | fillConstValue |
|                      |                    |                       | fillSendrValue |
|                      |                    | num2str               |                |
|                      | outputArray2Sht    | smartInsSheet         |                |
| generateOrderCkSht() | initConfig         | convertSht2Obj        |                |
|                      | sht2arr            |                       |                |
|                      | formatOrder4Check  | deleteOverlap         |                |
|                      |                    | clipRowsforCheck      |                |
|                      |                    | deleteOverlapOrderNum |                |
|                      |                    | num2str               |                |
|                      | outputArray2Sht    | smartInsSheet         |                |

- やっていることは単純なので、もっとシンプルに書けないものかと自問自答している。
