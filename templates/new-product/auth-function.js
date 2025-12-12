// CloudFront Function - JWT認証チェック
// 共通認証基盤と連携してJWTトークンを検証

function handler(event) {
  var request = event.request;
  var headers = request.headers;

  // 認証不要のパス
  var publicPaths = [
    '/login',
    '/register',
    '/callback',
    '/static/',
    '/favicon.ico',
    '/robots.txt',
    '/_next/',
    '/api/public/'
  ];

  var uri = request.uri;

  // 公開パスはスキップ
  for (var i = 0; i < publicPaths.length; i++) {
    if (uri.startsWith(publicPaths[i])) {
      return request;
    }
  }

  // Authorizationヘッダーをチェック
  var authHeader = headers.authorization;

  if (!authHeader) {
    // Cookieからトークンを取得
    var cookies = headers.cookie;
    if (cookies) {
      var cookieValue = cookies.value;
      var tokenMatch = cookieValue.match(/platform_token=([^;]+)/);
      if (tokenMatch) {
        // Cookieからトークンを取得してAuthorizationヘッダーに設定
        request.headers.authorization = { value: 'Bearer ' + tokenMatch[1] };
        return request;
      }
    }

    // 認証なし - ログインページへリダイレクト
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: {
        'location': { value: '/login?redirect=' + encodeURIComponent(uri) }
      }
    };
  }

  // JWTの基本検証（形式チェック）
  var token = authHeader.value.replace('Bearer ', '');
  var parts = token.split('.');

  if (parts.length !== 3) {
    return {
      statusCode: 401,
      statusDescription: 'Unauthorized',
      body: JSON.stringify({ error: 'Invalid token format' })
    };
  }

  try {
    // ペイロードをデコード
    var payload = JSON.parse(atob(parts[1]));

    // 有効期限チェック
    var now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        statusCode: 401,
        statusDescription: 'Unauthorized',
        body: JSON.stringify({ error: 'Token expired' })
      };
    }

    // ユーザー情報をヘッダーに追加
    if (payload.sub) {
      request.headers['x-user-id'] = { value: payload.sub };
    }
    if (payload.email) {
      request.headers['x-user-email'] = { value: payload.email };
    }

  } catch (e) {
    return {
      statusCode: 401,
      statusDescription: 'Unauthorized',
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }

  return request;
}

// Base64デコード（CloudFront Functionで利用可能）
function atob(str) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var output = '';

  str = str.replace(/=+$/, '');

  for (var bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++);) {
    buffer = chars.indexOf(buffer);
    if (buffer === -1) continue;
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & bs >> (-2 * bc & 6));
    }
  }

  return output;
}
