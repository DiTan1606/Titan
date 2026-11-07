/**
 * Titan · Gmail → Titan
 *
 * Mỗi phút tìm email biên lai mới của VCB Digibank trong Gmail và gửi nội dung về Titan.
 * Chạy trên máy chủ Google, miễn phí. Hướng dẫn cài đặt: docs/04-ket-noi-gmail.md
 *
 * Cài đặt (làm 1 lần):
 *   1. Project Settings → Script properties → thêm TITAN_TOKEN = token lấy trong Titan (Cài đặt).
 *   2. Chạy hàm `setup` (cấp quyền khi Google hỏi).
 */

// Thay <project-ref> bằng mã project Supabase của bạn
const TITAN_URL = 'https://<project-ref>.supabase.co/functions/v1/ingest-sms';
const VCB_SENDER = 'VCBDigibank@info.vietcombank.com.vn';
// Chỉ xem email 3 ngày gần nhất; email cũ hơn đã được xử lý từ trước.
const SEARCH_QUERY = 'from:' + VCB_SENDER + ' newer_than:3d';
// Nhớ tối đa bấy nhiêu email đã gửi để không gửi lại (Titan cũng tự chống trùng theo số lệnh).
const MAX_REMEMBERED = 300;

/** Chạy 1 lần: tạo lịch chạy mỗi phút. */
function setup() {
  if (!getToken_()) throw new Error('Chưa có TITAN_TOKEN trong Script properties');
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncReceipts'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncReceipts').timeBased().everyMinutes(1).create();
  syncReceipts();
  Logger.log('✅ Đã bật đồng bộ mỗi phút');
}

/** Tắt đồng bộ. */
function teardown() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Đã tắt đồng bộ');
}

/** Được lịch gọi mỗi phút. */
function syncReceipts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // lần chạy trước chưa xong
  try {
    const done = loadDone_();
    const threads = GmailApp.search(SEARCH_QUERY, 0, 30);
    let sent = 0;
    threads.forEach(function (thread) {
      // Gmail có thể gom các biên lai cùng tiêu đề vào một cuộc hội thoại → duyệt từng email
      thread.getMessages().forEach(function (message) {
        const id = message.getId();
        if (done.indexOf(id) !== -1) return;
        if (message.getFrom().indexOf(VCB_SENDER) === -1) return;
        const result = send_(bodyText_(message));
        if (result.ok) {
          done.push(id);
          sent++;
          Logger.log(id + ' → ' + result.status);
        } else {
          Logger.log(id + ' → lỗi ' + result.code + ', sẽ thử lại lần sau');
        }
      });
    });
    saveDone_(done);
    if (sent) Logger.log('Đã gửi ' + sent + ' biên lai');
  } finally {
    lock.releaseLock();
  }
}

/** Gửi thử biên lai mới nhất (để kiểm tra kết nối). Không đánh dấu đã gửi. */
function testLatest() {
  const threads = GmailApp.search('from:' + VCB_SENDER, 0, 1);
  if (!threads.length) return Logger.log('Không thấy email biên lai nào');
  const messages = threads[0].getMessages();
  const result = send_(bodyText_(messages[messages.length - 1]));
  Logger.log(JSON.stringify(result));
}

// ─────────────────────────────────────────────────────────────

function send_(text) {
  const response = UrlFetchApp.fetch(TITAN_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-titan-token': getToken_() },
    payload: JSON.stringify({ text: text, sender: VCB_SENDER }),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  let status = '';
  try { status = JSON.parse(response.getContentText()).status || ''; } catch (e) {}
  // 2xx: đã xử lý (created / duplicate / ignored / failed đều không cần gửi lại)
  // 401: token sai → dừng hẳn để không spam; 5xx / mạng: thử lại lần sau
  if (code === 401) throw new Error('TITAN_TOKEN sai hoặc đã bị thu hồi — tạo token mới trong Titan');
  return { ok: code >= 200 && code < 300, code: code, status: status };
}

function bodyText_(message) {
  const plain = message.getPlainBody();
  if (plain && plain.indexOf('Order Number') !== -1) return plain;
  // Một số email chỉ có HTML → bỏ thẻ, giữ xuống dòng giữa các ô bảng
  return message.getBody()
    .replace(/<(br|\/p|\/div|\/tr|\/td|\/th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’');
}

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('TITAN_TOKEN');
}

function loadDone_() {
  const raw = PropertiesService.getScriptProperties().getProperty('DONE_IDS');
  return raw ? JSON.parse(raw) : [];
}

function saveDone_(ids) {
  PropertiesService.getScriptProperties().setProperty('DONE_IDS', JSON.stringify(ids.slice(-MAX_REMEMBERED)));
}
