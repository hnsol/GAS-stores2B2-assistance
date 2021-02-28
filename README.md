# GAS-stores2B2-assistance
assist editing Invoice data: from stores to yamato B2 Cloud

## はじめに

[Stores（ストアーズ）](https://stores.jp/ec)には[「送り状CSV出力（ヤマトB2クラウド）」](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)という機能があって、送り状を簡単に作成できる……はずだが……。

おおまかなワークフロー（作業の流れ）は下図の通り。注文をいただいて、発送する。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Context_before.png" width=75%>

STORESから送り状用のCSVがダウンロードでき、「[手書き作業やデータのコピー＆ペーストの手間を省き、送り状発行業務の効率化](https://officialmag.stores.jp/entry/kaigyou/kinou-okurijo-yamato)」になるはずだが（なっていると思うが）、それでも意外とパソコン作業に手間がかかる。

たとえば、送り状CSVデータをダウンロードしたら、Excelで編集したい人が多いと思う。ところが、データの冒頭がゼロだと、ゼロが消えてしまう。

> 電話番号フィールド`09087654321`を取り込むと`9087654321`となる。郵便番号も、北海道はゼロから始まる！

そのほかにも（ショップ固有の条件で）、いろいろ手作業がある。勉強も兼ねて、これらの自動化をGAS(Google Apps Script)で行った。

<br>

## 全体ワークフローと、「コンピュータに任せたい」こと

ワークフローをもう少し拡大する。下図の青塗り「出荷作業支援」がGASが自動化するところ。手作業をなるべく減らし、ミスや手戻りがなくなるよう、コンピュータが得意なことは、コンピュータにお願いする。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Context.png" width=75%>


### コンピュータに任せたいこと

1. CSVの、フィールド１文字目がゼロの場合、Excelに取り込むとゼロが消える　⇒　消えないように取り込んでほしい
2. 送り状CSVデータは、「未発送」のみが出力対象　⇒　「未入金」レコードも、送り状CSVに取り込んでほしい
> - STORESのCSV書き出し機能の仕様。オプション指定不可
> - 送り状の作成の着手が遅くなり、急ぐとミスが起きがち
>    - 手作業でデータを取り込むとミスが多発しそうで怖い
3. 送り状CSVデータの「依頼主」が固定値　⇒　自動的に書き換えてほしい
>    - 購入者と配送先が異なるのは、プレゼント利用なので「送り主＝購入者」としたい
>    - STORESの仕様で、「送り主」には必ずショップの住所・氏名が入っている
>    - 手作業で書き換えているが、ミスが発生しそうで怖い
4. いくつかの列には固定値を自動的に埋めておいてほしい
>    - たとえば請求先コードは、すべてのレコードで同じ値
>    - 手作業（Excelのコピペ）でもできるが、コンピュータが得意なことはコンピュータに任せたい
5. 出荷時チェック用のシートを自動的に出力してほしい
>    - オーダー情報（もっとも正しいデータ）と照らし合わせ、最終チェックを行いたい
>    - オーダー情報のうち、不要な箇所を取り除くことと、必要な箇所を強調すること（たとえば「要領収書」）は、自動的にやってもらえるととても助かる

<br>

## もう少し詳細なワークフロー

STORESからCSVを受け取り、配送を依頼するまでの範囲のワークフローを拡大すると、下図のようになる。

<img src="https://raw.githubusercontent.com/hnsol/GAS-stores2B2-assistance/main/images/DaaC/C4_Container.png" width=75%>

STORESからは、「オーダー」と「送り状」の2つのCSVをダウンロードすることができる。これらのCSVから、「チェックシート」と「送り状CSVを加工したシート」を作成する。

- チェックシートは、できたものを印刷する。最終的な目視確認で使用
- 送り状CSVを加工し、これをエクセルシートにコピペする


## GAS(Google Apps Script)

<img src="https://github.com/hnsol/GAS-stores2B2-assistance/blob/main/images/SS_configsheet.png" width="320px">



## function structure


| #01           | #02                  | #03               |
| ------------- | -------------------- | ----------------- |
| buttonStart() | generateInvoiceSht() | initConfig        |
|               |                      | sht2arr           |
|               |                      | clipWPLine        |
|               |                      | mapOrderToB2      |
|               |                      | concat2DArray     |
|               |                      | formatYamatB2     |
|               |                      | outputArray2Sht   |
|               | generateOrderCkSht() | initConfig        |
|               |                      | sht2arr           |
|               |                      | formatOrder4Check |
|               |                      | outputArray2Sht   |
|               |                      |                   |

| #02                  | #03               | #04                   | #05            |
| -------------------- | ----------------- | --------------------- | -------------- |
| generateInvoiceSht() | initConfig        | convertSht2Obj        |                |
|                      | sht2arr           |                       |                |
|                      | clipWPLine        | clipLine              |                |
|                      |                   | groupConcat           |                |
|                      | mapOrderToB2      |                       |                |
|                      | concat2DArray     |                       |                |
|                      | formatYamatB2     | sortByOrderDate       |                |
|                      |                   | xxxUme                | fillConstValue |
|                      |                   | num2str               |                |
|                      | outputArray2Sht   | smartInsSheet         |                |
|                      |                   |                       |                |
| generateOrderCkSht() | initConfig        | convertSht2Obj        |                |
|                      | sht2arr           |                       |                |
|                      | formatOrder4Check | deleteOverlap         |                |
|                      |                   | clipRowsforCheck      |                |
|                      |                   | deleteOverlapOrderNum |                |
|                      |                   | num2str               |                |
|                      | outputArray2Sht   | smartInsSheet         |                |

不必要に複雑にしているのか……！？　書き換えたときに、おもったよりは影響範囲が少ないとは思ったけれども。

