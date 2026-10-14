"""TikTok metadata for the shared 4YOU TikTok account (used by make.sh -> upload.json['tiktok']).

Settings: root config.json -> tiktok (shared by all channels); a desk config.json -> tiktok may override single fields.
Caption: video title (without #shorts) + the YouTube description (summary, sources, hashtags, AI disclaimer),
kept under TikTok's 2,200-character limit. The disclaimer is never cut: first the source list is shortened
to outlet names, then the summary paragraph is trimmed.
"""
import re

LIMIT = 2150  # TikTok allows 2,200 characters; keep a margin


def _strip_shorts(s):
    return re.sub(r'[ \t]*#shorts\b', '', s or '', flags=re.I).strip()


def _compact_sources(desc):
    paras = desc.split('\n\n')
    for i, p in enumerate(paras):
        if p.lstrip().lower().startswith('sources'):
            lines = [l.strip() for l in p.split('\n')[1:] if l.strip()]
            if lines:
                names = [l.split(':')[0].strip() for l in lines]
                paras[i] = 'Sources: ' + ', '.join(names) + '.'
    return '\n\n'.join(paras)


def _join(title, desc):
    if title and not desc.startswith(title):
        return title + '\n\n' + desc
    return desc


def tiktok_meta(u, cfg, root_cfg):
    tt = dict(root_cfg.get('tiktok') or {})
    tt.update(cfg.get('tiktok') or {})
    if not tt:
        return None
    tt.pop('note', None)
    title = _strip_shorts(u.get('title', ''))
    desc = _strip_shorts(u.get('description', ''))
    cap = _join(title, desc)
    if len(cap) > LIMIT:
        desc = _compact_sources(desc)
        cap = _join(title, desc)
    if len(cap) > LIMIT:
        paras = desc.split('\n\n')
        over = len(cap) - LIMIT
        first = paras[0]
        cut = first[:max(0, len(first) - over - 2)]
        cut = cut.rsplit(' ', 1)[0] if ' ' in cut else cut
        paras[0] = cut.rstrip(' ,;:') + ' …'
        cap = _join(title, '\n\n'.join(paras))
    tt['title'] = title[:150]
    tt['caption'] = cap
    return tt
