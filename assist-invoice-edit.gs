/**
 * 開始用のボタンを押したときに反応を返します
 */
function buttonStart() {
  // 開始確認（OKボタン以外は処理を中断）
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    'シート作成の開始',
    'Excelコピペ用シートと、チェック用シートの作成を開始します。\nよろしいですか？',
    ui.ButtonSet.OK_CANCEL
    );
  if (response !== ui.Button.OK) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const shtStart = ss.getActiveSheet();

  generateInvoiceSht(); // 入金待ちデータ取り込み & 編集支援
  generateOrderCkSht(); // オーダー情報からチェックシートを作成

  ss.setActiveSheet(shtStart); // 開始時のシートにフォーカスを戻す

  // 終了メッセージ
  var response = ui.alert(
    '完了しました！',
    'シート作成が完了しました。ご確認ください。',
    ui.ButtonSet.OK
    );
}


/**
 * storesのB2出力csvの編集を少し楽にできるよう、データをシートに書き出します
 */
function generateInvoiceSht() {

  // 'config'から設定値を取得;
  var config = {};
  // NOTE: Objectなのにconfig = と書かないかん理由がまだわかってない
  config = initConfig('config', config);

  // シートから配列を取り出す
  var arrOrder = sht2arr(config.inShtOrder);  // オーダー情報
  var arrYamat = sht2arr(config.inShtYamat);  // ヤマト用出力

  // オーダー情報から入金待ちの行を抽出
  var arrWPU = clipWPLine(arrOrder, config);

  // 入金待ちの配列を、オーダー情報形式からヤマトB2形式に変換
  var arrWPUB2 = mapOrderToB2(arrWPU, config);

  // ※追加※オーダー情報のうち、配送先と購入者が異なる場合、ヤマトB2データを修正
  modifySenderYamato(arrYamat, arrOrder, config);

  // yamato.csvデータと、入金待ちの配列を結合
  var arrWPUB2C = concat2DArray(arrYamat, arrWPUB2, 0);

  // ※追加※結合済み出力前データの整形
  formatYamatB2(arrWPUB2C, config);

  // 配列を出力シートに書き出す
  outputArray2Sht(arrWPUB2C, config.outShtYamatCp);
}

/**
 * オーダー情報上で、配送先と購入者が異なる場合、ヤマトB2データを修正する
 */
function modifySenderYamato(arrYamat, arrOrder, config) {
  const idxto = config.odsndto;
  const idxfm = config.odsndfr;

  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var   setPickOrders = new Set();  // ピップアップ対象のオーダー番号
  var   arrPick = [];               // 対象情報ピックアップ用
  var   arrModYamato  = [];         // ヤマト伝票書き換え用の情報（２次元）

  // ヘッダは取り置いておく（オーダー番号以外の値が取得されてしまわないように）
  const arrOrderHeader = arrOrder.shift();

  // オーダー情報で、*(配送先) != *(購入者)　であるような行の、オーダー番号を取得
  // NOTE:1つでも異なれば、対象行とする
  // NOTE:おなじオーダー番号で複数行があり得るが、オーダー番号は1つだけ取る
  arrOrder.forEach( (line, lineNo) => {
    // arrOrderの各行について、購入者情報 != 配送先情報 のとき、
    // その行番号（lineNo）を記録する（重複する場合は記録しない）
    idxfm.forEach( (fromrow, index ) => {
      if ( line[fromrow] != line[idxto[index]]) {
      setPickOrders.add(lineNo);
      }
    })
  })

  // 該当行を取得し配列化（オーダー番号ごとに1行だけ取得している） 
  setPickOrders.forEach( lineNo => {
    arrPick.push(arrOrder[lineNo]);
  })

  // 該当行配列から、次に使う書き換え用の配列を生成
  // [ オーダー番号, ご依頼主電話番号, ご依頼主郵便番号, ご依頼主住所,
  //   ご依頼主アパートマンション, ご依頼主名 ]
  // HACK: ここは手抜きだがハードコーディング
  // NOTE: configに書き出してもあとで余計に混乱する気が
  arrPick.forEach( line => {
    arrModYamato.push( [line[0], line[44], line[41], line[42]+line[43],
    '', line[39] + ' ' + line[40]]);
  })

  // 取得したオーダー番号をキーにして、ヤマトB2の依頼主情報を書き換える
  const arrYamatOrder = transpose(arrYamat)[0]; // オーダー番号だけ並べた1次元配列

  // arrYamatのオーダー情報が一致する行を特定し、書き換え
  arrModYamato.forEach( row => {
    // 行の特定
    let lineno = arrYamatOrder.indexOf(row[0]);
    // 書き換え
    // HACK: ここは手抜きだがハードコーディング
    // NOTE: configに書き出してもあとで余計に混乱する気が
    arrYamat[lineno][19] = row[1]; // ご依頼主電話番号
    arrYamat[lineno][21] = row[2]; // ご依頼主郵便番号
    arrYamat[lineno][22] = row[3]; // ご依頼主住所
    arrYamat[lineno][23] = row[4]; // ご依頼主アパートマンション（いつも''）
    arrYamat[lineno][24] = row[5]; // ご依頼主名
  })

  return arrYamat

}


/**
 * storesのB2出力について、オーダー情報からチェック用シートを作成します
 */
function generateOrderCkSht() {

  // 'config'から設定値を取得;
  var config = {};
  // NOTE: Objectなのにconfig = と書かないかん理由がまだわかってない
  config = initConfig('config', config);

  // シートから配列を取り出す
  var arrOD = sht2arr(config.inShtOrder);

  // 配列をチェックシート用に加工
  var arrODC = formatOrder4Check(arrOD, config);

  // 配列を出力シートに書き出す
  outputArray2Sht(arrODC, config.outShtOrderCk);
}



/**
 * 設定値を、設定シートから取り込みます
 * @param {string} shtName  操作対象のシートの名前
 * @param {Object} config   設定値オブジェクト
 */
function initConfig(shtName, config) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var shtConfig = ss.getSheetByName(shtName);
  config = convertSht2Obj(shtConfig);

  // HACK:カンマで分割して配列化→ここは手打ち、一般化するいい方法を思い付いていない
  config.samaume = config.samaume.split(","); // like 'true,'様',17'
  config.bancume = config.bancume.split(","); // like 'true,'京都府...町99-99',22'
  config.kanaume = config.kanaume.split(","); // like 'true,'ﾄﾅﾘﾉﾄﾄﾛ',23'
  config.wareume = config.wareume.split(","); // like 'true,'ワレモノ注意',30'
  config.tentume = config.tentume.split(","); // like 'true,'天地無用',31'
  config.seikume = config.seikume.split(","); // like 'true,'09099999999',39'
  config.untiume = config.untiume.split(","); // like 'true,'true,'01',41'
  config.odckolf = config.odckolf.split(","); // like '33,34,35,36,37,38'
  config.odckolt = config.odckolt.split(","); // like '39,40,41,42,43,44'
  config.odckrow = config.odckrow.split(","); // like '0,8,12,13,33,34,35,36,37,38,46,47,39,40,41,42,43,44'
  config.odsndto = config.odsndto.split(","); // like '33,34,35,36,37,38'
  config.odsndfr = config.odsndfr.split(","); // like '39,40,41,42,43,44'
  config.umehncs = config.umehncs.split(","); // like '19,090791488750'
  config.constst = config.constst.split(","); // like '090..,60..,京..,御..,09..,01,入金待ち,603.'

  return config;
}

/**
 * シートからJSONオブジェクトを作成
 * （1行目はヘッダ、1列目にプロパティ名、2列目にプロパティ値が入っている前提）
 * @param {Object} sheet  シートオブジェクト
 * @return {Object} obj   設定値オブジェクト
 */ 
function convertSht2Obj(sheet) {
  var array = sheet.getDataRange().getValues();
  array.shift();
  var obj = new Object();
  array.forEach( line => obj[line[0]] = line[1] );
  return obj;
}

/**
 * シートからデータを取得します
 * @param {Object} sht  操作対象シート　// 変更中
 * @return {Array} arr  シートから取得した値（2次元配列）
 */
function sht2arr(shtName) {
  // シートから値を配列に取得
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // シートを取得。取得でエラーが発生した場合、アラートを出してシート名を表示し、プログラム終了
  try {
    var arr = ss.getSheetByName(shtName).getDataRange().getValues();
  } catch(e) {
    const ui = SpreadsheetApp.getUi();
    const rs = ui.alert('処理を停止します', '「シートの名前」が間違っているようです: ' + shtName, ui.ButtonSet.OK);
    throw e;
  }
    
  return arr;
}


/**
 * 入金待ちの行を抽出します
 * @param {string} shtOrder オーダー情報シートの名前
 * @return {Array} arrWPU   取得データの2次元配列 
 * TODO: arrは上位で取っておいて、arrを受け取って処理するように変えたほうがいい
 */
function clipWPLine(arrOrder, config) {

  // ①入金待ちのレコードを抽出
  // like clipLine(arrOrder, 1, '入金待ち');
  var arrWP = clipLine(arrOrder, config.cliprow, config.clipstr);

  // 入金待ちの行が全く存在しない場合は、arrWP（空の配列）を返す
  // エラー処理のしかたを再度考えたが、こうするのが最も目的に沿うとおもう
  if ( arrWP.length < 1 ) return arrWP;

  // ②品名欄を連結し、重複レコードを削除
  // like groupConcat(arrWP, 0, 8, ', ');
  var arrWPU = groupConcat(arrWP, config.conckey, config.concrow, config.concdelm);

  return arrWPU; 
}

/**
 * 2次元配列arrのなかで、col列が値valであるものを抽出します
 * @param {Array}  arr        抽出用の2次元配列
 * @param {number} col        抽出対象列
 * @param {string} val        抽出キー
 * @return {Array} arrClipped 抽出後の2次元配列 
 */
function clipLine(arr, col, val) {
  var arrClipped = arr.filter( value => value[col] === val );
  return arrClipped;
}

/**
 * 2次元配列arrのなかで、key列が同じ行の、colを連結します
 * @param {Array}  arr    操作対象の2次元配列   
 * @param {number} key    重複判定対象列のインデックス
 * @param {number} col    連結対象列のインデックス
 * @param {string} dlm    デリミタ
 * @return {Array} arrGC  連結後の2次元配列 
 */
function groupConcat(arr, key, col, dlm){

  // arrのlengthの値を取っておく
  // arrLength にfirstindex、arrLength + 1に連結文字列を格納する
  // return前に長さを戻す、ため
  var arrLength = arr[0].length; 

  // 行列を入れ替える関数を定義
  // TODO:場所はここがいいか？
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var key_t = transpose(arr)[key];
  // console.log(key_t);
  // like [ '6649065905', '4314438123', '6666217936', '9928044714', '9928044714' ]

  // key列の値が、はじめて登場する行のindexを、valueのいちばん後ろに付与する(firstindex)
  arr.forEach( value => value.push(key_t.indexOf(value[key])) );

  // 行のindexとfirstindexが一致するなら、品名を配列のお尻にくっつける
  arr.forEach( function(value, index, array) {
    var aln = value.length;     // 現在行の項目数を取得（品名付与前）
    var fid = value[aln-1];     // firstindexの値をfidに入れる

    if (index === fid) {        // 現在行のindexが、firstindexと一致するなら
      value.push(value[col]);   // col列を現在行の最後にくっつける
    } else {                    // 現在行のindex <> firstindexなら
      // firstindex行のお尻の品名(=aln)に、現在行の品名をくっつける 
      // ''は文字列への変換保証のため
      array[fid][aln] += ( '' + dlm + value[col] );
    }
  })

  // col列に、結合した文字列（品名）を書き戻し、結合文字列は消す
  arr.forEach( (value, index) => {
    if (index === value[arrLength]) value[col] = value[arrLength + 1];
    value.length = arrLength + 1
  });

  // indexとfirstindexが一致するものだけ拾う
  var arrGC = arr.filter( (value, index) => {
    return index === value[value.length -1];
  });

  // もとの長さに戻す
  arrGC.forEach( value => value.length = arrLength );

  return arrGC;
}

/**
 * オーダー形式のデータをB2形式へマッピングします
 * @param  {Array} arrOrder 操作対象の2次元配列   
 * @return {Array} arrB2    連結後の2次元配列 
 * TODO:configに外出しするのが望ましい
 */
function mapOrderToB2(arrOrder, config) {
  var arrB2 = [];

  // 今は下記行がなくても想定通り動いているが、明示的に処理の意図を記述した
  if (arrOrder.length < 1) return arrB2;

  // インデックス設定：1to1マッピング　※列数から1マイナスのこと
  var io_ordernum = 0,  ib_ordernum = 0;  // オーダー番号
  var io_phonenum = 38, ib_phonenum = 8;  // お届け先電話番号
  var io_yubinnum = 35, ib_yubinnum = 10; // お届け先郵便番号
  var io_senditem = 8,  ib_senditem = 27; // 品名１
  var io_emailadd = 45, ib_emailadd = 48; // お届け予定ｅメール
  var io_comments = 47, ib_comments = 95; // 備考欄
  var io_memomemo = 48, ib_memomemo = 96; // メモ
  var io_wpayment = 2,  ib_wpayment = 97; // 支払い方法
  
  // 固定値
  var ib_sendphon = 19, cb_sendphon = config.constst[0]; // ご依頼主電話番号
  var ib_sendyubn = 21, cb_sendyubn = config.constst[1]; // ご依頼主郵便番号
  var ib_sendaddr = 22, cb_sendaddr = config.constst[2]; // ご依頼主住所
  var ib_sendname = 24, cb_sendname = config.constst[3]; // ご依頼主名
  var ib_clntcode = 39, cb_clntcode = config.constst[4]; // 請求先顧客コード
  var ib_chargnum = 41, cb_chargnum = config.constst[5]; // 運賃管理番号
  var ib_itemstat = 98, cb_itemstat = config.constst[6]; // ステータス
  
  // 結合値
  var io_ad1 = 36, io_ad2 = 37, ib_ad1 = 11, ib_ad2 = 12; // お届け先住所 マンション名
  var io_na1 = 33, io_na2 = 34, ib_nam = 15;              // お届け先名

  for (i=0 ;i<arrOrder.length; i++) {
    // console.log(i, arrB2[0,0], arrOrder[0][0]);
    var arrB2line = new Array(99);

    // 1to1マッピング
    // NOTE: 数値の冒頭ゼロ問題の回避は別途行うので、"'"をつけない
    arrB2line[ib_ordernum] = arrOrder[i][io_ordernum]; // オーダー番号
    arrB2line[ib_phonenum] = arrOrder[i][io_phonenum]; // お届け先電話番号
    arrB2line[ib_yubinnum] = arrOrder[i][io_yubinnum]; // お届け先郵便番号
    arrB2line[ib_senditem] = arrOrder[i][io_senditem]; // 品名１
    arrB2line[ib_emailadd] = arrOrder[i][io_emailadd]; // お届け予定ｅメール
    arrB2line[ib_comments] = arrOrder[i][io_comments]; // 備考欄
    arrB2line[ib_memomemo] = arrOrder[i][io_memomemo]; // メモ
    arrB2line[ib_wpayment] = arrOrder[i][io_wpayment]; // 支払い方法

    // 固定値
    // NOTE: 数値の冒頭ゼロ問題の回避は別途行うので、"'"をつけない
    arrB2line[ib_sendphon] = cb_sendphon; // ご依頼主電話番号
    arrB2line[ib_sendyubn] = cb_sendyubn; // ご依頼主郵便番号
    arrB2line[ib_sendaddr] = cb_sendaddr; // ご依頼主住所
    arrB2line[ib_sendname] = cb_sendname; // ご依頼主名
    arrB2line[ib_clntcode] = cb_clntcode; // 請求先顧客コード
    arrB2line[ib_chargnum] = cb_chargnum; // 運賃管理番号
    arrB2line[ib_itemstat] = cb_itemstat; // ステータス

    // 結合値
    arrB2line[ib_ad1] = arrOrder[i][io_ad1] + arrOrder[i][io_ad2];        // お届け先住所
    arrB2line[ib_nam] = arrOrder[i][io_na1] + ' ' + arrOrder[i][io_na2];  // お届け先名

    arrB2.push(arrB2line);
  }
    
  return arrB2
}

/**
 * 2次元配列arr1とarr2を連結します
 * NOTE:ここまで一般化しなくていい気がするけど、動いているので触っていない
 * @param {Array}  arr1 連結対象の2次元配列
 * @param {Array}  arr2 連結対象の2次元配列
 * @param {number} axis   1:横方向に結合　1以外:縦方向に結合
 * @return {Array} arr3
 * NOTE:ここまで一般化しなくていい気がするけど、動いているので触っていない
 * https://qiita.com/hikobotch/items/bda1e23879dd842cee35
 * TODO:forループが回っているで、lengthチェックがあったほうがいいと思う
 */
function concat2DArray(arr1, arr2, axis) {
  if(axis != 1) axis = 0;
  var arr3 = [];
  if (axis == 0) {  // 縦方向の結合
    arr3 = arr1.slice();
    for (var i = 0; i < arr2.length; i++) {
      arr3.push(arr2[i]);
    }
  } else {          // 横方向の結合
    for (var i = 0; i < arr1.length; i++) {
      arr3[i] = arr1[i].concat(arr2[i]);
    }
  }
  return arr3;
}

/**
 * 配列をいい感じに整形します
 * @param {Array}  arrWPUB2C  整形する配列
 * @param {Object} config     設定情報を格納したオブジェクト
 */
function formatYamatB2(arrWPUB2C, config)　{

  // 結合したデータをオーダー日でソート
  sortByOrderDate(arrWPUB2C, config.inShtOrder);

  // xxx埋め
  xxxUme(arrWPUB2C, config);

  // 数字だけの項目には"'"をつける
  num2str(arrWPUB2C);
}

/**
 * 配列をオーダー日でソートします
 * @param {Array}  arrWPUB2C  配列（ソート前）
 * @param {string} shtOrder   オーダー情報のシート名称
 * @return {Array} arrWPUB2C  配列（ソート後）
 */
function sortByOrderDate(arrWPUB2C, shtName) {
  // オーダーシートを配列に読み込み
  // var arrOrder = shtOrder.getDataRange().getValues();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  var arrOrder = ss.getSheetByName(shtName).getDataRange().getValues();
  // 行列を入れ替える関数を定義
  // todo:場所はここがいいか？ なんどもでているのでよくない気がする
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));

  // オーダーシートの、オーダー番号だけを拾った1次元配列
  // like [ 'オーダー番号', '2176468849', '6058601867', '5037548365', ... ]
  var orderNum = transpose(arrOrder)[0];

  // 入力配列のヘッダを取り分けておく、配列の長さも取っておく
  var arrWPUB2Cheader = arrWPUB2C.shift();
  var arrWPUB2Clength = arrWPUB2C[0].length;

  // 配列の各行の最終列にオーダー日を追加
  arrWPUB2C.forEach( value => {
    var idxorder = orderNum.indexOf(value[0]);
    // オーダー日の列[3]を直打ち
    if (idxorder > 0) {
      value.push(arrOrder[idxorder][3]);  
    } else {
      // 何かの事情でオーダー情報からオーダー日を拾えなかった場合
      // ダミー値を入れておく（nullだとソートができないため）
      value.push('2001-01-01 01:00:00');
    }
  })

  // 配列をsc列で降順でソート（sc: Sort Column）
  var sc = arrWPUB2Clength;
  arrWPUB2C.sort(function(a, b){
	  if (a[sc] > b[sc]) return -1;
	  if (a[sc] < b[sc]) return 1;
	  return 0;
  });

  // 最終列に追加したオーダー日を削除
  arrWPUB2C.forEach( value => value.length = arrWPUB2Clength);

  // ヘッダを戻す（忘れそう……）
  return arrWPUB2C.unshift(arrWPUB2Cheader);
}

/**
 * 配列の、特定の列を同じデータで埋めます
 * @param {Array}  arrWPUB2C  操作対象配列
 * @param {Object} config      コンフィグ値の入っているオブジェクト
 */
function xxxUme(arrWPUB2C, config) {
  fillConstValue(arrWPUB2C, config.samaume); // 様埋め
  fillConstValue(arrWPUB2C, config.wareume); // ワレモノ注意埋め
  fillConstValue(arrWPUB2C, config.tentume); // 天地無用埋め
  fillConstValue(arrWPUB2C, config.seikume); // 請求先顧客コード埋め
  fillConstValue(arrWPUB2C, config.untiume); // 運賃管理番号埋め

  // 単純な埋めではないケース（条件分岐があるため）
  fillSendrValue(arrWPUB2C, config.bancume, config.umehncs);  // 住所番地埋め
  fillSendrValue(arrWPUB2C, config.kanaume, config.umehncs);  // カナ埋め

}

/**
 * 同じデータで指定列を埋めます
 * @param {Array}  arr  操作対象の2次元配列
 * @param {Array}  prm  設定値配列 like [ 'false', '様', '17' ]
 * @return {Array} arr
 */ 
function fillConstValue(arr, prm) {
  var isGo = (prm[0] == 'true') ? true : false; // ON-OFFを判定
  var txt = prm[1], col = prm[2];

  var header = arr.shift();

  // col列をtxtで埋める
  if (isGo) arr.forEach( value => value[col] = txt );
  
  return arr.unshift(header);
}

/**
 * 同じデータで指定列を埋めます（依頼主が異なる場合があるので関数を分けた）
 * @param {Array}  arr  操作対象の2次元配列
 * @param {Array}  prm  設定値配列 like [ 'false', '様', '17' ]
 * @return {Array} arr
 */ 
function fillSendrValue(arr, prm, judge) {
  var isGo = (prm[0] == 'true') ? true : false; // ON-OFFを判定
  var txt = prm[1], col = prm[2];
  var judgeCol = +judge[0], judgeStr = judge[1];

  var header = arr.shift();


  // col列をtxtで埋める
  // !! 依頼主がデフォではない場合、何もしない !!
  if (isGo) arr.forEach( value => {
    // if ( value[19] == '090791488750') value[col] = txt });
    if ( value[judgeCol] == judgeStr ) value[col] = txt });
  
  return arr.unshift(header);
}

/**
 * 数字だけの項目に"'"をつけます
 * @param {Array}  arr 操作対象の2次元配列
 * @return {Array} arr "'"付与済みの2次元配列
 */
function num2str(arr) {

  // 正規表現：正の整数値（カンマに対応していないことに注意）
  var regexp = new RegExp(/^[0-9]+(\.[0-9]+)?$/);

  arr.forEach( (line, idxlin) =>
    line.forEach( (col, idxcol) => {
      if ( regexp.test(col) ) arr[idxlin][idxcol] = "'" + col;  
    })
  )

  return arr;
}

/**
 * 配列を指定シートに出力
 * @param {Array} array     シートに書き込む配列 
 * @param {string} shtName  書き込み先シートの名前
 */
function outputArray2Sht(array, shtName) {

  // 新規シートを作成
  var outSht = smartInsSheet(shtName);

  // シートをクリアして、配列を書き込む（すべて文字列とする）
  outSht.clearContents();
  outSht
    .getRange(1, 1, array.length, array[0].length)
    .setNumberFormat('@')
    .setValues(array);
}
  
/**
 * 新規シートをかしこく挿入します
 * @param {string} shtName  新規シートの名前
 * @return {Object}         作成した新規シートオブジェクト
 */
function smartInsSheet(shtName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // コピー先のシートがすでに存在する場合は、削除する
  var prevSht = ss.getSheetByName(shtName);
  if (prevSht !== null) ss.deleteSheet(prevSht);

  ss.insertSheet(shtName, ss.getNumSheets());

  return ss.getSheetByName(shtName);
}


/**
 * オーダー情報を、チェック用にフォーマットします
 */
function formatOrder4Check(arrOD, config) {

  // 重複列を削除
  deleteOverlap(arrOD, config.odckolf, config.odckolt);

  // 必要列に集約　// NOTE: RowsじゃなくてColumnsだ……
  var arrODC = clipRowsforCheck(arrOD, config.odckrow);

  // オーダー番号をuniqueにする HACK: 0は直打ち
  deleteOverlapOrderNum(arrODC, 0);

  // 数字だけの項目には"'"をつける
  num2str(arrODC);

  return arrODC;
}

/**
 * 2次元配列の、指定列F,Tでの重複があればT列を削除します
 * @param {Array}  arr   操作対象の2次元配列
 * @param {string} idxfm 重複チェックの指定列
 * @param {string} idxto 重複チェックの指定列、この列を削除
 * @return {Array} arr   書き換え後の2次元配列
 */
function deleteOverlap(arr, idxfm, idxto) {

  arr.forEach( line => {
    idxfm.forEach( (val, idx) => {
      if (line[val] == line[idxto[idx]]) line[idxto[idx]] = "";
    })
  })

  return arr;
}

/**
 * チェックシートに必要な行を抽出します // NOTE: RowsじゃなくてColumnsだ……
 * @param {Array} array     操作対象の2次元配列
 * @param {string} rowsClip 抽出する列 like [ '0', '8', '12', '13', '25' ]
 * @return {Array}          抽出後の2次元配列
 */
function clipRowsforCheck(array, rowsClip) {
  // console.log(rowsClip);
  // 行列入れ替え
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var arrayT = transpose(array);

  // 抽出
  var arrayCT = [];
  rowsClip.forEach( val => arrayCT.push(arrayT[val]) );

  // 行列を入れ替えてリターン
  return transpose(arrayCT);
}

/**
 * 指定列の重複値を削除します
 * @param {Array} array   操作対象の2次元配列
 * @param {string} row    抽出する列 like 0
 * @return {Array} array  抽出後の2次元配列
 */
function deleteOverlapOrderNum(array, row) {

  // 行列を入れ替えた配列を用意
  // TODO:関数化しようね……
  const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
  var arrayT = transpose(array);

  // 指定列の値が、初出で「ない」ならば、その値を''に置き換える
  // NOTE: arrayT[row][idx]ではなくarray[idx][row]を書き換えている
  arrayT[row].forEach( (val, idx) => {
    if (idx !== arrayT[row].indexOf(val)) array[idx][row] = '';
  });

  return array;
}



// /**
//  * 2次元配列の行と列を入れ替えます
//  */
// function transpose(array) {
//   // const transpose = a => a[0].map((_, c) => a.map(r => r[c]));
//   console.log(array[0]);
//   array[0].map((_, c) => array.map(r => r[c]));
//   console.log(array[0]);
  
//   return array;
// }  


/**
 * 
 * | #01           | #02                  | #03               |
 * | ------------- | -------------------- | ----------------- |
 * | buttonStart() | generateInvoiceSht() | initConfig        |
 * |               |                      | sht2arr           |
 * |               |                      | clipWPLine        |
 * |               |                      | mapOrderToB2      |
 * |               |                      | concat2DArray     |
 * |               |                      | formatYamatB2     |
 * |               |                      | outputArray2Sht   |
 * |               | generateOrderCkSht() | initConfig        |
 * |               |                      | sht2arr           |
 * |               |                      | formatOrder4Check |
 * |               |                      | outputArray2Sht   |
 * |               |                      |                   |
 * 
 * | #02                  | #03               | #04                   | #05            |
 * | -------------------- | ----------------- | --------------------- | -------------- |
 * | generateInvoiceSht() | initConfig        | convertSht2Obj        |                |
 * |                      | sht2arr           |                       |                |
 * |                      | clipWPLine        | clipLine              |                |
 * |                      |                   | groupConcat           |                |
 * |                      | mapOrderToB2      |                       |                |
 * |                      | concat2DArray     |                       |                |
 * |                      | formatYamatB2     | sortByOrderDate       |                |
 * |                      |                   | xxxUme                | fillConstValue |
 * |                      |                   | num2str               |                |
 * |                      | outputArray2Sht   | smartInsSheet         |                |
 * |                      |                   |                       |                |
 * | generateOrderCkSht() | initConfig        | convertSht2Obj        |                |
 * |                      | sht2arr           |                       |                |
 * |                      | formatOrder4Check | deleteOverlap         |                |
 * |                      |                   | clipRowsforCheck      |                |
 * |                      |                   | deleteOverlapOrderNum |                |
 * |                      |                   | num2str               |                |
 * |                      | outputArray2Sht   | smartInsSheet         |                |
 * 
 */
