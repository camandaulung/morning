import sys, math, json
from collections import Counter
from PIL import Image
out = {}
for p in sys.argv[1:]:
    im = Image.open(p).convert("RGB")
    im = im.resize((im.width // 2, im.height // 2))
    w, h = im.size
    px = im.load()
    q = Counter()
    lum = []
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            q[(r >> 4, g >> 4, b >> 4)] += 1
            lum.append(0.2126 * r + 0.7152 * g + 0.0722 * b)
    n = w * h
    ent = -sum(c / n * math.log2(c / n) for c in q.values())
    dom = q.most_common(1)[0][1] / n
    edges = 0
    for y in range(h - 1):
        for x in range(w - 1):
            i = y * w + x
            if abs(lum[i] - lum[i + 1]) + abs(lum[i] - lum[i + w]) > 40:
                edges += 1
    s = sorted(lum)
    out[p.replace("\\", "/").split("/")[-1]] = {
        "colorEntropyBits": round(ent, 2),
        "dominantColorShare": round(dom, 3),
        "edgeDensity": round(edges / n, 3),
        "luminanceContrast_p95_p5": round(s[int(n * 0.95)] - s[int(n * 0.05)], 1),
    }
print(json.dumps(out, indent=1))
