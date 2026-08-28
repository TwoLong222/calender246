// Mô tả sự kiện cho phép HTML (in đậm, gạch đầu dòng, liên kết...). Nơi nào CHỈ
// hiển thị được chữ thuần (file .ics, thông báo đổi lịch, bản xem trước) thì phải
// bóc thẻ ra trước, không thì người dùng đọc phải "<b>Họp</b>".
//
// Lưu ý bảo mật: hàm này KHÔNG phải bộ lọc an toàn. Chỗ nào vẽ HTML thật thì dùng
// [innerHTML] của Angular — Angular tự lọc script/onclick/javascript: trước khi vẽ.

/** Bóc hết thẻ HTML, trả về chữ thuần đọc được. */
export function htmlToPlain(html: string | undefined | null): string {
  if (!html) return '';
  // Không dùng innerHTML để đọc: gán chuỗi lạ vào DOM có thể chạy <img onerror>.
  // DOMParser tạo tài liệu rời, script/onerror trong đó không bao giờ chạy.
  const doc = new DOMParser().parseFromString(
    html.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n'),
    'text/html',
  );
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Chuỗi này có chứa thẻ HTML THẬT không (dùng để biết nên vẽ HTML hay chữ thuần).
 * CHỈ nhận các thẻ HTML thường gặp — KHÔNG bắt nhầm kiểu "Nhãn<https://...>" của
 * Outlook/Teams (URL để trong ngoặc nhọn). Trước đây regex /<[a-z].*>/ coi luôn "<https"
 * là thẻ -> trình phân tích HTML nuốt mất URL -> link không bấm được.
 */
export function looksLikeHtml(text: string | undefined | null): boolean {
  return (
    !!text &&
    /<\/?(a|abbr|b|blockquote|br|code|div|em|h[1-6]|hr|i|img|li|ol|p|pre|s|small|span|strong|sub|sup|table|tbody|td|th|thead|tr|u|ul)\b[^>]*>/i.test(
      text,
    )
  );
}

/** Đổi ký tự đặc biệt thành thực thể HTML để chữ thuần không bị hiểu nhầm là thẻ. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Dấu câu dính đuôi URL khi người ta viết "vào https://a.com/x." — phải cắt ra. */
const TRAILING = /[.,;:!?)\]}>'"]+$/;

/**
 * Biến URL trần trong CHỮ thành thẻ <a> bấm được.
 *
 * Chỉ đụng vào node CHỮ, và bỏ qua phần nằm trong <a>/<code>/<pre> — nếu thay bằng
 * regex trên cả chuỗi HTML thì sẽ phá luôn href của liên kết người dùng tự viết.
 */
function linkifyTextNodes(doc: Document): void {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('a, code, pre')) continue;
    if (/https?:\/\/|www\./i.test(node.data)) targets.push(node);
  }

  for (const node of targets) {
    const frag = doc.createDocumentFragment();
    let last = 0;
    // (1) "Nhãn<https://...>" kiểu Outlook/Teams -> dùng NHÃN làm chữ hiện, ẩn URL thô + ngoặc nhọn.
    // (2) URL trần -> tự thành link (chữ hiện = chính URL).
    const re = /([^\s<>][^<>\n]*?)<(https?:\/\/[^\s<>]+)>|(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.data)) !== null) {
      let url: string;
      let label: string;
      let consumeEnd: number;
      if (m[2]) {
        url = m[2].replace(TRAILING, '');
        label = (m[1] || '').trim() || url; // nhãn rỗng thì rơi về hiện URL
        consumeEnd = m.index + m[0].length; // nuốt cả "nhãn<url>"
      } else {
        url = m[3].replace(TRAILING, '');
        if (!url) continue;
        label = url;
        consumeEnd = m.index + url.length; // TRAILING cắt bớt -> chỉ nuốt phần URL
      }
      if (m.index > last) frag.appendChild(doc.createTextNode(node.data.slice(last, m.index)));
      const a = doc.createElement('a');
      a.href = url.startsWith('www.') ? `https://${url}` : url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      frag.appendChild(a);
      last = consumeEnd;
    }
    if (last < node.data.length) frag.appendChild(doc.createTextNode(node.data.slice(last)));
    node.replaceWith(frag);
  }
}

/**
 * Chuẩn bị mô tả để vẽ ra màn hình:
 *  - chữ thuần  -> giữ nguyên xuống dòng (\n thành <br>)
 *  - có sẵn HTML -> giữ nguyên thẻ người dùng viết
 *  - cả hai đều được dò URL trần để bấm vào là mở được.
 *
 * Kết quả LUÔN đi qua [innerHTML] của Angular, nên script/onclick vẫn bị Angular lọc.
 */
export function descriptionToHtml(text: string | undefined | null): string {
  if (!text) return '';
  const html = looksLikeHtml(text) ? text : escapeHtml(text).replace(/\r?\n/g, '<br>');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  linkifyTextNodes(doc);
  return doc.body.innerHTML;
}
