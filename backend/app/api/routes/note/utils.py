def title_from_markdown(body: str, max_len: int = 120) -> str:
    text = (body or "").strip()
    if not text:
        return "Untitled"
    first = text.splitlines()[0].strip()
    if not first:
        return "Untitled"
    if len(first) > max_len:
        return first[: max_len - 1].rstrip() + "…"
    return first


def join_chunks_markdown(chunks: list) -> str:
    ordered = sorted(chunks, key=lambda c: (c.sort_order, c.created_ts))
    parts = [(c.body_md or "").strip() for c in ordered]
    return "\n\n".join(p for p in parts if p)
