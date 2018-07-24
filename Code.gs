/**
 ********************************************************************************
 * GASの「スクリプトのプロパティ」に定義が必要
 * - SLACK_HOOK_URI
 * - DARK_SKY_SECRET_KEY
 * - LATITUDE
 * - LONGITUDE
 ********************************************************************************
 */

var LF = "\n";
var DARK_SKY_SITE_URL = "https://darksky.net/dev";

/**
 * 「ウェブアプリケーションとして導入」で公開した場合、POSTリクエストはこの関数が呼ばれる。
 * Slackのスラッシュコマンドのエンドポイントとして設定する。
 * 
 * @param e
 * @returns {*}
 */
function doPost(e) {
  const message = createBodyMessage();
  const response = {
    "text": message,
    "username": "お天気bot",
    "icon_emoji": ":japan:"
  };

  return ContentService
          .createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
}

/**
 * お天気ボットの起動
 */
function notifyWeather() {
  const message = createBodyMessage();
  send_to_slack(message, "お天気bot", ":japan:");
}

/**
 * 返却メッセージを作成
 * 
 * @returns {string}
 */
function createBodyMessage() {
  const latitude = PropertiesService.getScriptProperties().getProperty('LATITUDE');
  const longitude = PropertiesService.getScriptProperties().getProperty('LONGITUDE');
  const weather = getWeatherFromDarkSky(latitude, longitude, ["lang=ja", "units=ca", "exclude=currently,minutely,hourly,flags"]);

  var message = "";

  // 現在天気
//  const current = makeMessageFromDarkSky(weather["currently"]);
//  message += "現在の天気：" + current["icon"] + current["summary"] + "　" + current["other"] + LF;

  // 週間予報
  var buffer = [];
  var maxDateKeta = 0;
  var maxSummaryKeta = 0;
  weather["daily"]["data"].forEach(function(element) {
    const result = makeMessageFromDarkSky(element);
    maxDateKeta    = Math.max(maxDateKeta,    result["date"].length);
    maxSummaryKeta = Math.max(maxSummaryKeta, result["summary"].length);
    buffer.push(result);
  });
  buffer.forEach(function(element){
    message += LF + leftPadding(element["date"], maxDateKeta) + "は：" + element["icon"] + rightPadding(element["summary"], maxSummaryKeta) + element["other"];
  });

  message += LF + "Provided by: Dark Sky (" + DARK_SKY_SITE_URL + ")";

  return message;
}

/**
 * お天気botで通知する内容に整形する
 */
function makeMessageFromDarkSky(data) {
  var other = "";

  if (data.hasOwnProperty("temperature")) {
    other += "気温：" + data["temperature"] + "℃　";
  }

  if (data.hasOwnProperty("temperatureHigh")) {
    other += "最高気温：" + data["temperatureHigh"] + "℃　";
  }

  if (data.hasOwnProperty("temperatureLow")) {
    other += "最低気温：" + data["temperatureLow"] + "℃　";
  }

  other += "降水確率：" + Math.round(100 * data['precipProbability'], 0) + '％　';

  if (data.hasOwnProperty("humidity")) {
    other += '湿度：' + Math.round(100 * data['humidity'], 0) + '％　';
  }

  return {
    "date": getDateLabel(data["time"], new Date()),
    "icon": getSlackIconFromDarkSky(data["icon"]),
    "summary": fixHankaku(data["summary"]),
    "other": other
  };
}

/**
 * Dark Sky APIから天気情報を取得する
 * 
 * NOTE: https://api.darksky.net/forecast/[key]/[latitude],[longitude]
 */
function getWeatherFromDarkSky(latitude, longitude, optionParams) {
  const baseUri = "https://api.darksky.net/forecast/";
  const secretKey = PropertiesService.getScriptProperties().getProperty('DARK_SKY_SECRET_KEY');
  const uri = baseUri + secretKey + "/" + latitude + "," + longitude + "?" + optionParams.join("&");
  const response = UrlFetchApp.fetch(uri);
  return JSON.parse(response.getContentText());
}

/**
 * Slackにメッセージを送る
 */
function send_to_slack(message, userName, icon) {
  const uri = PropertiesService.getScriptProperties().getProperty('SLACK_HOOK_URI');

  const jsonData = {
    "username": userName,
    "text": message
  };
  if (icon) {
    jsonData["icon_emoji"] = icon;
  }
  
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(jsonData)
  };

  UrlFetchApp.fetch(uri, options);
}

/**
 * Dark Sky APIでとれた"icon"値をslackアイコンに変換する
 */
function getSlackIconFromDarkSky(darkSkyIcon) {
  const list = {
    "clear-day":   ":sun_with_face:", // 晴れ
    "clear-night": ":star2:",         // 晴れ
    "cloudy":              ":cloud:", // 曇り
    "partly-cloudy-day":   ":sun_behind_cloud:", // 曇り晴れ
    "partly-cloudy-night": ":cloud:", // 曇り晴れ
    "rain": ":umbrella_with_rain_drops:", // 雨
    "snow": ":snowflake:",     // 雪
    "sleet": ":rain_cloud:", // みぞれ
    "wind": ":wind_blowing_face:", // 風？
    "fog": ":fog:",         // 霧
    "hail": ":rain_cloud:", // 雹
    "thunderstorm": ":thunder_cloud_and_rain:",
    "tornado": ":tornado:"
  }

  return list.hasOwnProperty(darkSkyIcon) ? list[darkSkyIcon] : "";
}

/**********************************************************************************************************/
/* Utility */
/**********************************************************************************************************/
function fixHankaku(str) {
  // 半角英数を全角にする
  const newStr = str.replace(/[A-Za-z0-9]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });

  // 半角スペース、カンマ、ドットを取り除く
  return newStr.replace(/[ ,.]/g, "");
}

/**
 * 桁が足りない場合、左を全角空白で埋める
 */
function leftPadding(str, length) {
  return (Array(length).join('　') + str).slice(-length);
}

/**
 * 桁が足りない場合、右を全角空白で埋める
 */
function rightPadding(str, length) {
  return (str + Array(length).join('　')).slice(0, length);
}

/**
 * 日付情報を読みやすい形式にして返す
 */
function getDateLabel(unixTime, nowDate) {
  // 0 は日曜日、1 は月曜日、2 は火曜日
  const weekDayLabel = ['（日）', '（月）', '（火）', '（水）', '（木）', '（金）', '（土）'];
  const date = new Date(unixTime * 1000);
  const tomorrow = new Date(nowDate.getTime() + 24*60*60*1000);
  
  var label = "";
  if (isSameDate(nowDate, date)) {
    label = "今日";
  } else if (isSameDate(tomorrow, date)) {
    label = "明日";
  } else {
    label = date.getDate()+"日 " + weekDayLabel[date.getDay()];
  }
  
  return fixHankaku(label);
}

/**
 * 同じ日ならtrueを返す
 */
function isSameDate(date1, date2) {
  return date1.getYear() === date2.getYear()
          && date1.getMonth() === date2.getMonth()
          && date1.getDate() === date2.getDate();
}
