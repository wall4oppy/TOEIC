import json
import re
from pathlib import Path


def load_questions(input_path: Path):
    with input_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def clean_option_text(text: str) -> str:
    """移除選項文字中的 '(正解)' 標記與多餘空白。"""
    if not isinstance(text, str):
        return ""
    # 去掉全形 / 半形括號內的「正解」
    text = re.sub(r"[\(（]\s*正解\s*[\)）]", "", text)
    return text.strip()


def parse_translation_block(raw: str):
    """
    原始 translation 例子：
    a. 這家餐廳失火了

    b. 大廚們正在將披薩放入烤爐內
    ...

    回傳：
    {
      "A": "...",
      "B": "...",
      ...
    }
    """
    if not isinstance(raw, str):
        return {}, ""

    lines = [line.strip() for line in raw.splitlines()]
    # 合併成單一字串方便前端若要顯示整段
    merged = "\n".join([ln for ln in lines if ln])

    result = {}
    current_key = None
    buffer = []

    def flush():
        nonlocal buffer, current_key
        if current_key and buffer:
            text = "\n".join([b for b in buffer if b]).strip()
            if text:
                result[current_key] = text
        buffer = []

    for line in lines:
        if not line:
            continue

        m = re.match(r"^([a-dA-D])\.\s*(.*)$", line)
        if m:
            # 新的一個選項翻譯開始
            flush()
            key = m.group(1).upper()
            rest = m.group(2).strip()
            current_key = key
            if rest:
                buffer.append(rest)
        else:
            # 延續上一行
            if current_key:
                buffer.append(line)

    flush()
    return result, merged


def transform_question(q: dict):
    # 共同欄位
    q_id = q.get("id")
    original_id = q.get("originalId")
    part = q.get("part")
    exam_id = q.get("examId")
    label = q.get("questionLabel")
    image = q.get("image")
    audio = q.get("audio")
    text = q.get("text", "") or ""

    # 選項
    options = []
    for opt in q.get("options", []):
        key = opt.get("label")
        raw_text = opt.get("text", "")
        options.append(
            {
                "key": key,
                "text": clean_option_text(raw_text),
            }
        )

    answer = q.get("correctAnswer")

    # 翻譯
    translation_by_option, translation_raw = parse_translation_block(
        q.get("translation", "")
    )

    # 組合題資訊（先原樣保留，給前端決定怎麼用）
    has_group = q.get("hasGroup", False)
    group_content = q.get("groupContent")

    return {
        "id": q_id,
        "originalId": original_id,
        "part": part,
        "examId": exam_id,
        "label": label,
        "type": "multiple_choice",
        "image": image,
        "audio": audio,
        "text": text,
        "options": options,
        "answer": answer,
        # 原始整段中文翻譯（方便顯示或除錯）
        "translationRaw": translation_raw,
        # 已拆成 A/B/C/D 的翻譯
        "translation": translation_by_option,
        # 組合題資訊
        "hasGroup": has_group,
        "group": group_content,
    }


def main():
    base_dir = Path(__file__).resolve().parent
    input_path = base_dir / "questions.json"
    output_path = base_dir / "web_questions.json"

    if not input_path.exists():
        print(f"找不到檔案: {input_path}")
        return

    data = load_questions(input_path)

    if not isinstance(data, list):
        print("questions.json 格式異常：預期是題目陣列(list)。")
        return

    transformed = [transform_question(q) for q in data]

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)

    print(f"已產生：{output_path}，共 {len(transformed)} 題。")


if __name__ == "__main__":
    main()



