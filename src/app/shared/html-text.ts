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

/** Chuỗi này có chứa thẻ HTML không (dùng để biết nên vẽ HTML hay chữ thuần). */
export function looksLikeHtml(text: string | undefined | null): boolean {
  return !!text && /<[a-z][\s\S]*>/i.test(text);
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
    const re = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.data)) !== null) {
      const raw = m[0].replace(TRAILING, '');
      if (!raw) continue;
      if (m.index > last) frag.appendChild(doc.createTextNode(node.data.slice(last, m.index)));
      const a = doc.createElement('a');
      a.href = raw.startsWith('www.') ? `https://${raw}` : raw;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = raw;
      frag.appendChild(a);
      last = m.index + raw.length;
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
